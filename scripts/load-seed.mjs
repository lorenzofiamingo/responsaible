// Build data/seed/seed.sql from data/seed/work-products.json.
//
// Apply it with `npm run seed:local` (wrangler d1 execute ... --file). Keeping
// authoring (JSON) separate from loading (SQL) means the Google ADK pipeline can
// emit the same JSON shape and reuse this loader unchanged.
//
// The supervisory-action hash chain is computed HERE with the same canonical
// format as src/lib/server/audit.ts, so seeded history + live actions verify as
// one chain.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const seedDir = resolve(root, 'data/seed');

const GENESIS_HASH = '0'.repeat(64);
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const auditInput = (prev, r) =>
	[prev, r.workProductId, r.actorEmail, r.action, r.reason, r.createdAt].join('|');

/** SQL string literal (or NULL). */
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const b = (v) => (v ? 1 : 0);
const json = (v) => (v === null || v === undefined ? 'NULL' : q(JSON.stringify(v)));

// --- atomic-claim derivation (stop-gap until the ADK claim-splitter writes
// explicit `claims`; keeps offsets exact and mirrors autoPreset in src/lib/workgroups.ts) ---

const MODAL_OBLIGATION = /\b(shall|must|is required to|may not|prohibited|obliged)\b/i;
// Sentence-final period that is actually an abbreviation — don't split there.
const ABBR_TAIL = /(?:\b(?:Inc|Ltd|Corp|Co|Art|Arts|No|Nos|Reg|Dir|e\.g|i\.e|etc|vs|v|cf|Cf)\.|\b[A-Z]\.)\s*$/;

function autoPresetJs(text, kind) {
	if (kind === 'heading' || kind === 'boilerplate' || text.trim().length < 40) return 'quick_scan';
	if (/\[\d+\]/.test(text) || kind === 'citation_ref' || kind === 'obligation' || MODAL_OBLIGATION.test(text))
		return 'authority_deep_dive';
	return 'standard_review';
}

/** Split a body into sentence spans, preserving exact [start,end) offsets and merging abbreviations. */
function splitSentences(body) {
	const re = /[^.!?]*[.!?]+(?=\s|$)/g;
	const raw = [];
	let m;
	let lastEnd = 0;
	while ((m = re.exec(body)) !== null) {
		raw.push({ index: m.index, str: m[0] });
		lastEnd = m.index + m[0].length;
	}
	if (lastEnd < body.length && body.slice(lastEnd).trim()) {
		raw.push({ index: lastEnd, str: body.slice(lastEnd) });
	}
	// Merge a chunk into the next when it ends on an abbreviation.
	const out = [];
	for (let i = 0; i < raw.length; i++) {
		let { index, str } = raw[i];
		while (i < raw.length - 1 && ABBR_TAIL.test(str.trimEnd())) {
			i++;
			str = body.slice(index, raw[i].index + raw[i].str.length);
		}
		const lead = str.length - str.trimStart().length;
		const start = index + lead;
		const end = index + str.trimEnd().length;
		const text = body.slice(start, end);
		if (text) out.push({ text, start, end });
	}
	return out;
}

function classifyKind(text) {
	if (/\[\d+\]/.test(text)) return 'citation_ref';
	if (MODAL_OBLIGATION.test(text)) return 'obligation';
	if (text.trim().length < 40) return 'boilerplate';
	return 'assertion';
}

/** A deterministic baseline analysis per claim (the seeded fallback the run reveals). */
function baselineAnalysis(wp, claimText, markers, idx) {
	const jitter = (((idx * 37) % 11) - 5) / 100;
	const base = Math.max(0.2, Math.min(0.97, (wp.confidence ?? 0.7) + jitter));
	const docRisks = wp.riskSignals ?? [];
	const allMarkers = (wp.citations ?? []).map((c) => c.marker ?? 0);
	const maxMarker = allMarkers.length ? Math.max(...allMarkers) : 0;
	const badRisk = docRisks.find(
		(r) => (r.category === 'hallucination' || r.category === 'missing_authority') && r.severity === 'high'
	);

	if (markers.length && badRisk && markers.includes(maxMarker)) {
		return {
			verdict: 'unsupported',
			confidence: 0.33,
			summary: 'The cited authority could not be verified against EU law — likely fabricated.',
			riskCategory: badRisk.category,
			riskSeverity: 'high',
			riskRationale: badRisk.rationale
		};
	}
	if (markers.length) {
		const medRisk = docRisks.find((r) => r.severity === 'med' || r.severity === 'high');
		return {
			verdict: 'supported',
			confidence: base,
			summary: 'Grounded in the cited EU authority.',
			riskCategory: medRisk ? medRisk.category : null,
			riskSeverity: medRisk ? medRisk.severity : null,
			riskRationale: medRisk ? medRisk.rationale : ''
		};
	}
	const obligation = MODAL_OBLIGATION.test(claimText);
	return {
		verdict: obligation ? 'weak' : 'supported',
		confidence: obligation ? Math.max(0.4, base - 0.1) : Math.min(0.95, base + 0.04),
		summary: obligation ? 'States an obligation without a direct citation.' : 'Background statement; no authority required.',
		riskCategory: obligation ? 'missing_authority' : null,
		riskSeverity: obligation ? 'low' : null,
		riskRationale: obligation ? 'Obligation asserted without an inline authority on this sentence.' : ''
	};
}

function deriveClaims(wp) {
	const body = wp.body ?? '';
	return splitSentences(body).map((s, idx) => {
		const markers = [...s.text.matchAll(/\[(\d+)\]/g)].map((mm) => Number(mm[1]));
		const kind = classifyKind(s.text);
		return {
			idx,
			text: s.text,
			charStart: s.start,
			charEnd: s.end,
			kind,
			assignedPreset: autoPresetJs(s.text, kind),
			citationMarkers: markers,
			analysis: baselineAnalysis(wp, s.text, markers, idx)
		};
	});
}

const items = JSON.parse(readFileSync(resolve(seedDir, 'work-products.json'), 'utf8'));

const lines = [];
lines.push('-- GENERATED by scripts/load-seed.mjs — do not edit by hand.');
lines.push('PRAGMA foreign_keys=OFF;');
// Idempotent reset (children first).
for (const t of [
	'supervisory_action',
	'risk_signal',
	'citation',
	'agent_action',
	'atomic_claim',
	'work_product'
]) {
	lines.push(`DELETE FROM ${t};`);
}

// Collect every seeded supervisory action globally, then chain by createdAt.
const audits = [];

for (const wp of items) {
	lines.push(
		`INSERT INTO work_product (id, type, title, summary, body, matter_ref, matter_name, agent_name, status, priority, confidence, model, created_at) VALUES (` +
			[
				q(wp.id),
				q(wp.type),
				q(wp.title),
				q(wp.summary ?? ''),
				q(wp.body ?? ''),
				q(wp.matterRef ?? ''),
				q(wp.matterName ?? ''),
				q(wp.agentName ?? ''),
				q(wp.status ?? 'pending'),
				wp.priority ?? 0,
				wp.confidence ?? 0,
				q(wp.model ?? ''),
				q(wp.createdAt)
			].join(', ') +
			');'
	);

	for (const a of wp.trace ?? []) {
		lines.push(
			`INSERT INTO agent_action (id, work_product_id, step, kind, actor_agent, summary, detail, created_at) VALUES (` +
				[
					q(`${wp.id}_a${a.step}`),
					q(wp.id),
					a.step,
					q(a.kind),
					q(a.actorAgent ?? ''),
					q(a.summary),
					json(a.detail ?? null),
					q(a.createdAt ?? wp.createdAt)
				].join(', ') +
				');'
		);
	}

	(wp.citations ?? []).forEach((c, i) => {
		lines.push(
			`INSERT INTO citation (id, work_product_id, marker, claim, celex, eli, title, source_url, snippet, locator, supports_claim, verified, verify_status, verified_at) VALUES (` +
				[
					q(`${wp.id}_c${c.marker ?? i + 1}`),
					q(wp.id),
					c.marker ?? i + 1,
					q(c.claim ?? ''),
					q(c.celex ?? null),
					q(c.eli ?? null),
					q(c.title ?? ''),
					q(c.sourceUrl ?? null),
					q(c.snippet ?? ''),
					q(c.locator ?? ''),
					b(c.supportsClaim ?? true),
					b(c.verified ?? false),
					q(c.verifyStatus ?? 'unchecked'),
					q(c.verifiedAt ?? null)
				].join(', ') +
				');'
		);
	});

	(wp.riskSignals ?? []).forEach((r, i) => {
		lines.push(
			`INSERT INTO risk_signal (id, work_product_id, category, severity, rationale, confidence) VALUES (` +
				[q(`${wp.id}_r${i + 1}`), q(wp.id), q(r.category), q(r.severity), q(r.rationale), r.confidence ?? 0].join(
					', '
				) +
				');'
		);
	});

	// Atomic claims — the body split into verifiable units, with a seeded baseline
	// analysis (status starts 'pending'; the supervisor reveals it by running it).
	// Use explicit `claims` from the ADK pipeline when present; otherwise derive
	// them deterministically from the body so offsets are always exact.
	(wp.claims ?? deriveClaims(wp)).forEach((c) => {
		const a = c.analysis ?? {};
		lines.push(
			`INSERT INTO atomic_claim (id, work_product_id, idx, text, char_start, char_end, kind, assigned_preset, status, analysis_source, preset_used, work_group_json, verdict, analysis_summary, confidence, risk_category, risk_severity, risk_rationale, citation_markers, figure_trace, ran_at, created_at) VALUES (` +
				[
					q(`${wp.id}_claim${c.idx}`),
					q(wp.id),
					c.idx,
					q(c.text ?? ''),
					c.charStart ?? 0,
					c.charEnd ?? 0,
					q(c.kind ?? 'assertion'),
					q(c.assignedPreset ?? 'standard_review'),
					q('pending'),
					'NULL', // analysis_source — null until run
					q(''), // preset_used
					'NULL', // work_group_json
					q(a.verdict ?? null),
					q(a.summary ?? ''),
					a.confidence ?? 0,
					q(a.riskCategory ?? null),
					q(a.riskSeverity ?? null),
					q(a.riskRationale ?? ''),
					json(c.citationMarkers ?? null),
					json(a.figureTrace ?? null),
					'NULL', // ran_at
					q(wp.createdAt)
				].join(', ') +
				');'
		);
	});

	(wp.auditSeed ?? []).forEach((s, i) => {
		audits.push({ ...s, workProductId: wp.id, _localId: `${wp.id}_s${i + 1}` });
	});
}

// Order globally by time, then chain.
audits.sort((x, y) => (x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0));
let prev = GENESIS_HASH;
for (const s of audits) {
	const fields = {
		workProductId: s.workProductId,
		actorEmail: s.actorEmail,
		action: s.action,
		reason: s.reason ?? '',
		createdAt: s.createdAt
	};
	const hash = sha256(auditInput(prev, fields));
	lines.push(
		`INSERT INTO supervisory_action (id, work_product_id, actor_email, action, reason, prev_hash, hash, created_at) VALUES (` +
			[
				q(s._localId),
				q(fields.workProductId),
				q(fields.actorEmail),
				q(fields.action),
				q(fields.reason),
				q(prev),
				q(hash),
				q(fields.createdAt)
			].join(', ') +
			');'
	);
	prev = hash;
}

lines.push('PRAGMA foreign_keys=ON;');
lines.push('');

const out = resolve(seedDir, 'seed.sql');
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(
	`Wrote ${out}\n  work_products: ${items.length}\n  audit actions: ${audits.length}\n  last chain hash: ${prev.slice(0, 12)}…`
);
