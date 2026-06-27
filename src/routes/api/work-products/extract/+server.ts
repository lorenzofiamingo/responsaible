import { CAN_SUBMIT } from '$lib/format';
import { extractWorkProduct } from '$lib/server/extract';
import { docxToText } from '$lib/server/extract/docx';
import { pdfToText } from '$lib/server/extract/pdf';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Kept modest on purpose: a PDF is fully buffered in memory and pdf.js's object
// graph is several× the raw size, so a large file risks the workerd 128 MB cap.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB upload ceiling
const MAX_CHARS = 60_000; // analysis input ceiling
const MIN_CHARS = 12; // below this there's nothing to analyse

/**
 * Document intake. Accepts either a multipart upload (`file`: PDF or text) or a
 * JSON body (`{ text, filename }`), extracts the text (PDF → text via unpdf), and
 * returns a REVIEW-READY draft work product (NOT persisted). The /new page binds
 * the result so a supervisor can correct it before submitting to the queue.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	// Same gate as creation: only the supervising lawyer can run intake.
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can ingest documents.' }, { status: 403 });
	}

	// Reject oversized uploads from the Content-Length header BEFORE buffering the
	// body into memory (request.formData()/json() would otherwise allocate it all).
	const declaredLength = Number(request.headers.get('content-length') ?? 0);
	if (declaredLength > MAX_BYTES) {
		return json({ error: 'Upload is too large (max 8 MB).' }, { status: 413 });
	}

	let text = '';
	let filename: string | undefined;
	let sourceKind: 'text' | 'pdf' | 'docx' = 'text';

	const contentType = request.headers.get('content-type') ?? '';

	try {
		if (contentType.includes('multipart/form-data')) {
			const form = await request.formData();
			const file = form.get('file');
			const pastedText = form.get('text');

			if (file && typeof file !== 'string') {
				if (file.size > MAX_BYTES) {
					return json({ error: 'File is too large (max 8 MB).' }, { status: 413 });
				}
				filename = file.name || undefined;
				const name = file.name;
				const isPdf = /\.pdf$/i.test(name) || file.type === 'application/pdf';
				const isDocx =
					/\.docx$/i.test(name) ||
					file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
				const isLegacyDoc = /\.docx?$/i.test(name) && !isDocx; // bare .doc (binary OLE)
				if (isPdf) {
					sourceKind = 'pdf';
					const result = await pdfToText(await file.arrayBuffer());
					if (!result.ok) {
						return json(
							{ error: result.error ?? 'Could not read the PDF. Paste the text instead.' },
							{ status: 422 }
						);
					}
					text = result.text;
				} else if (isDocx) {
					sourceKind = 'docx';
					const result = await docxToText(await file.arrayBuffer());
					if (!result.ok) {
						return json(
							{ error: result.error ?? 'Could not read the Word document. Paste the text instead.' },
							{ status: 422 }
						);
					}
					text = result.text;
				} else if (isLegacyDoc) {
					return json(
						{ error: 'Legacy .doc files are not supported — save it as .docx, or paste the text.' },
						{ status: 422 }
					);
				} else {
					// Treat any other upload as plain text (.txt, .md, .json, …).
					text = await file.text();
				}
			} else if (typeof pastedText === 'string') {
				text = pastedText;
				filename = typeof form.get('filename') === 'string' ? String(form.get('filename')) : undefined;
			}
		} else {
			const body = (await request.json().catch(() => ({}))) as { text?: string; filename?: string };
			text = typeof body.text === 'string' ? body.text : '';
			filename = body.filename;
		}
	} catch (err) {
		return json({ error: `Could not read the upload: ${(err as Error).message}` }, { status: 400 });
	}

	text = text.trim();
	if (text.length < MIN_CHARS) {
		return json(
			{ error: 'Not enough text to analyse — paste the document or upload a file with selectable text.' },
			{ status: 400 }
		);
	}
	// Documents up to MAX_CHARS are analysed in full; only beyond it do we slice —
	// and we tell the operator rather than truncating silently.
	const overflow = Math.max(0, text.length - MAX_CHARS);
	if (overflow > 0) text = text.slice(0, MAX_CHARS);

	const apiKey = platform?.env?.GEMINI_API_KEY ?? platform?.env?.GOOGLE_API_KEY;
	const draft = await extractWorkProduct(text, { sourceKind, filename, apiKey });

	if (overflow > 0) {
		draft.meta.warnings.push(
			`Document exceeds the ${MAX_CHARS.toLocaleString('en-GB')}-character analysis limit; the last ${overflow.toLocaleString('en-GB')} characters were not analysed. Split it or review the remainder separately.`
		);
	}

	return json({ draft });
};
