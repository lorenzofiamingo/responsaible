import { CAN_SUBMIT, KNOWLEDGE_CATEGORY_ORDER } from '$lib/format';
import { dbFrom } from '$lib/server/db/client';
import { createFirmKnowledge, type NewFirmKnowledgeInput } from '$lib/server/db/queries';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CATEGORIES = KNOWLEDGE_CATEGORY_ORDER as readonly string[];
const BODY_CAP = 60_000;

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

function validate(raw: Raw): { ok: true; value: NewFirmKnowledgeInput } | { ok: false; error: string } {
	if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
	if (!str(raw.title).trim()) return { ok: false, error: 'title is required.' };
	if (!CATEGORIES.includes(str(raw.category))) {
		return { ok: false, error: `category must be one of ${CATEGORIES.join(', ')}.` };
	}

	// Tags arrive as an array (the form) or a pre-joined string; normalise to the
	// comma-separated blob the lexical ranker substring-matches over.
	const tags = Array.isArray(raw.tags)
		? raw.tags.map((t) => str(t).trim()).filter(Boolean).join(', ')
		: str(raw.tags).trim();

	const body = str(raw.body).trim().slice(0, BODY_CAP);
	if (!body) return { ok: false, error: 'body is required.' };

	return {
		ok: true,
		value: {
			title: str(raw.title).trim().slice(0, 200),
			category: str(raw.category) as NewFirmKnowledgeInput['category'],
			body,
			tags,
			sourceRef: str(raw.sourceRef).trim().slice(0, 200)
		}
	};
}

/**
 * Persist a document into the firm's private, cross-matter knowledge corpus.
 * Gated to the supervising lawyer. The corpus is firm-level — no matter scoping.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can add firm knowledge.' }, { status: 403 });
	}

	let raw: Raw;
	try {
		raw = (await request.json()) as Raw;
	} catch {
		return json({ error: 'Invalid JSON.' }, { status: 400 });
	}

	const result = validate(raw);
	if (!result.ok) return json({ error: result.error }, { status: 400 });

	const db = dbFrom(platform);
	const id = await createFirmKnowledge(db, result.value);
	return json({ id }, { status: 201 });
};
