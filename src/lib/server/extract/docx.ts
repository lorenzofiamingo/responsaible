/**
 * Word (.docx) → text for document intake.
 *
 * A .docx is a ZIP whose `word/document.xml` holds the body. We unzip just that
 * part with `fflate` (pure-JS, Workers-safe) and flatten the WordprocessingML to
 * plain text — paragraphs become newlines, tabs/breaks preserved. Dynamically
 * imported and wrapped in try/catch so it degrades to "paste the text instead",
 * exactly like pdf.ts. Legacy binary .doc is NOT a ZIP and is rejected upstream.
 */

export interface DocxResult {
	ok: boolean;
	text: string;
	error?: string;
}

function decodeEntities(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
		// Ampersand last, so we don't double-decode the entities above.
		.replace(/&amp;/g, '&');
}

/** Flatten WordprocessingML markup to plain text. */
function xmlToText(xml: string): string {
	return decodeEntities(
		xml
			.replace(/<w:tab\b[^>]*\/?>/g, '\t')
			.replace(/<w:br\b[^>]*\/?>/g, '\n')
			.replace(/<\/w:p>/g, '\n') // end of paragraph → line break
			.replace(/<[^>]+>/g, '') // drop every remaining tag
	);
}

export async function docxToText(bytes: ArrayBuffer): Promise<DocxResult> {
	try {
		const { unzipSync, strFromU8 } = await import('fflate');
		const files = unzipSync(new Uint8Array(bytes), {
			filter: (f) => f.name === 'word/document.xml'
		});
		const doc = files['word/document.xml'];
		if (!doc) {
			return {
				ok: false,
				text: '',
				error: 'This does not look like a .docx (no word/document.xml). Save as .docx or paste the text.'
			};
		}
		const text = xmlToText(strFromU8(doc)).replace(/[ \t]+\n/g, '\n').trim();
		if (!text) {
			return { ok: false, text: '', error: 'The Word document has no extractable text.' };
		}
		return { ok: true, text };
	} catch (err) {
		return { ok: false, text: '', error: `Could not read the Word document: ${(err as Error).message}` };
	}
}
