/**
 * PDF → text for document intake.
 *
 * Uses `unpdf` (a serverless build of pdf.js, designed for Cloudflare Workers).
 * Imported dynamically and wrapped in try/catch so the intake endpoint degrades
 * gracefully: if a PDF can't be read, the operator is told to paste the text
 * instead — the core "paste text → extract" path never depends on this module.
 */

export interface PdfResult {
	ok: boolean;
	text: string;
	pages: number;
	error?: string;
}

export async function pdfToText(bytes: ArrayBuffer): Promise<PdfResult> {
	try {
		const { extractText, getDocumentProxy } = await import('unpdf');
		const pdf = await getDocumentProxy(new Uint8Array(bytes));
		const { text, totalPages } = await extractText(pdf, { mergePages: true });
		const merged = Array.isArray(text) ? text.join('\n') : text;
		const clean = merged.trim();
		if (!clean) {
			return { ok: false, text: '', pages: totalPages ?? 0, error: 'The PDF has no extractable text (it may be a scanned image).' };
		}
		return { ok: true, text: clean, pages: totalPages ?? 0 };
	} catch (err) {
		return { ok: false, text: '', pages: 0, error: `Could not read the PDF: ${(err as Error).message}` };
	}
}
