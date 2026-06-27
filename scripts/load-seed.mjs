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
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
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

/** Minimal `---`-delimited frontmatter parser (no YAML dep) for the firm corpus. */
function parseFrontmatter(raw) {
	const meta = {};
	let body = raw;
	const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
	if (m) {
		for (const line of m[1].split('\n')) {
			const idx = line.indexOf(':');
			if (idx === -1) continue;
			const key = line.slice(0, idx).trim();
			if (key) meta[key] = line.slice(idx + 1).trim();
		}
		body = raw.slice(m[0].length);
	}
	return { meta, body: body.trim() };
}

// --- atomic-claim derivation (stop-gap until the ADK claim-splitter writes
// explicit `claims`; keeps offsets exact and mirrors autoPreset in src/lib/workgroups.ts) ---

const MODAL_OBLIGATION = /\b(shall|must|is required to|may not|prohibited|obliged)\b/i;

// A `.!?` run followed by whitespace/end normally ends a sentence — but NOT when
// the period belongs to an abbreviation, an initial, or a list/section marker.
// These patterns, tested against the chunk up to and including the terminator,
// flag "this period is not a boundary" so a list number ("1.", "1.1") or an
// abbreviation ("no. 5", "Art. 6") is never split off as its own claim.
// Case-insensitive, so "no.", "No." and "NO." all match.
const ABBR_TAIL =
	/\b(?:inc|ltd|corp|co|art|arts|no|nos|reg|dir|dirs|sec|cl|fig|para|paras|pp|p|e\.g|i\.e|etc|vs|v|cf|al|approx|mr|mrs|ms|dr|st)\.+$/i;
// A single capital initial, e.g. the "J." in "J. Smith".
const INITIAL_TAIL = /\b[A-Z]\.+$/;
// A numbered/lettered list or section marker that is the whole chunk so far —
// "1.", "1.1.", "a.", "(iv)." — where the period is part of the marker itself.
const LIST_MARKER = /^\s*(?:\d+(?:\.\d+)*|[A-Za-z]|\([0-9A-Za-z]+\))\.+$/;

/** True when the terminator ending `chunk` is part of an abbreviation/initial/marker, not a sentence end. */
function isNonBoundary(chunk) {
	return ABBR_TAIL.test(chunk) || INITIAL_TAIL.test(chunk) || LIST_MARKER.test(chunk);
}

function autoPresetJs(text, kind) {
	if (kind === 'heading' || kind === 'boilerplate' || text.trim().length < 40) return 'quick_scan';
	if (/\[\d+\]/.test(text) || kind === 'citation_ref' || kind === 'obligation' || MODAL_OBLIGATION.test(text))
		return 'authority_deep_dive';
	return 'standard_review';
}

/** Trim surrounding whitespace off [from,to) and push the span (exact offsets) when non-empty. */
function pushSpan(out, body, from, to) {
	const raw = body.slice(from, to);
	const lead = raw.length - raw.trimStart().length;
	const start = from + lead;
	const end = from + raw.trimEnd().length;
	const text = body.slice(start, end);
	if (text) out.push({ text, start, end });
}

/**
 * Split a body into sentence spans, preserving exact [start,end) offsets.
 * A `.!?` run followed by whitespace or end-of-text is a sentence boundary unless
 * it falls inside an abbreviation, an initial, or a list/section marker (see
 * isNonBoundary) — so "1.1" list items and "no. 5"-style references stay whole
 * instead of being chopped at every dot.
 */
function splitSentences(body) {
	const out = [];
	const re = /[.!?]+(?=\s|$)/g;
	let segStart = 0;
	let m;
	while ((m = re.exec(body)) !== null) {
		const termEnd = m.index + m[0].length;
		if (isNonBoundary(body.slice(segStart, termEnd))) continue;
		pushSpan(out, body, segStart, termEnd);
		segStart = termEnd;
	}
	// Any trailing text after the last boundary (an unterminated final sentence).
	if (segStart < body.length) pushSpan(out, body, segStart, body.length);
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
const matters = JSON.parse(readFileSync(resolve(seedDir, 'matters.json'), 'utf8'));
const matterById = new Map(matters.map((m) => [m.id, m]));

const lines = [];
lines.push('-- GENERATED by scripts/load-seed.mjs — do not edit by hand.');
lines.push('PRAGMA foreign_keys=OFF;');
// Idempotent reset (children first).
for (const t of [
	'supervisory_action',
	'risk_signal',
	'citation',
	'agent_action',
	'claim_edge',
	'atomic_claim',
	'work_product',
	'matter',
	'firm_knowledge'
]) {
	lines.push(`DELETE FROM ${t};`);
}

// Claim-edge relation vocabulary (mirrors src/lib/server/db/schema.ts).
const EDGE_RELATIONS = new Set(['premise', 'definition', 'elaboration', 'qualification', 'conflict']);
const ORDERING_RELATIONS = new Set(['premise', 'definition', 'elaboration']);

// Matters — the parent table; insert before any work_product that references them.
for (const m of matters) {
	lines.push(
		`INSERT INTO matter (id, ref, name, client, status, description, created_at) VALUES (` +
			[
				q(m.id),
				q(m.ref ?? ''),
				q(m.name ?? ''),
				q(m.client ?? ''),
				q(m.status ?? 'open'),
				q(m.description ?? ''),
				q(m.createdAt)
			].join(', ') +
			');'
	);
}

// Collect every seeded supervisory action globally, then chain by createdAt.
const audits = [];

for (const wp of items) {
	// A work product must belong to a known matter; matter_ref/matter_name are a
	// snapshot derived from that matter (single source of truth, like edge validation).
	const m = matterById.get(wp.matterId);
	if (!m) throw new Error(`${wp.id}: unknown matterId '${wp.matterId}'.`);
	lines.push(
		`INSERT INTO work_product (id, type, title, summary, body, matter_id, matter_ref, matter_name, agent_name, status, priority, confidence, model, created_at) VALUES (` +
			[
				q(wp.id),
				q(wp.type),
				q(wp.title),
				q(wp.summary ?? ''),
				q(wp.body ?? ''),
				q(m.id),
				q(m.ref),
				q(m.name),
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
	const wpClaims = wp.claims ?? deriveClaims(wp);
	const claimIdxs = new Set(wpClaims.map((c) => c.idx));
	wpClaims.forEach((c) => {
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

	// Typed reasoning-graph edges between this work product's atomic claims.
	// `from` (the dependent) RESTS ON `to` (the premise/target). Authored by claim
	// idx in the seed JSON (or emitted by the ADK claim-grapher); validated against
	// the claims actually inserted so any offset/idx drift is caught at build time.
	(wp.edges ?? []).forEach((e, i) => {
		if (!EDGE_RELATIONS.has(e.relation)) {
			throw new Error(`${wp.id}: edge #${i} has unknown relation '${e.relation}'.`);
		}
		if (!claimIdxs.has(e.from) || !claimIdxs.has(e.to)) {
			throw new Error(`${wp.id}: edge #${i} references a missing claim idx (${e.from} -> ${e.to}).`);
		}
		if (e.from === e.to) {
			throw new Error(`${wp.id}: edge #${i} is a self-loop on claim ${e.from}.`);
		}
		const ordering = e.ordering ?? ORDERING_RELATIONS.has(e.relation);
		lines.push(
			`INSERT INTO claim_edge (id, work_product_id, from_claim_id, to_claim_id, relation, rationale, is_ordering, created_at) VALUES (` +
				[
					q(`${wp.id}_edge${i}`),
					q(wp.id),
					q(`${wp.id}_claim${e.from}`),
					q(`${wp.id}_claim${e.to}`),
					q(e.relation),
					q(e.rationale ?? ''),
					b(ordering),
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

// The firm's private knowledge base — markdown docs under data/seed/firm-knowledge/.
const fkDir = resolve(seedDir, 'firm-knowledge');
let fkCount = 0;
if (existsSync(fkDir)) {
	for (const file of readdirSync(fkDir).filter((f) => f.endsWith('.md')).sort()) {
		const { meta, body } = parseFrontmatter(readFileSync(resolve(fkDir, file), 'utf8'));
		const id = meta.id || basename(file, '.md');
		lines.push(
			`INSERT INTO firm_knowledge (id, title, category, body, tags, source_ref, created_at) VALUES (` +
				[
					q(id),
					q(meta.title || id),
					q(meta.category || 'memo'),
					q(body),
					q(meta.tags || ''),
					q(meta.ref || meta.sourceRef || ''),
					q(meta.date || meta.createdAt || '2026-01-01T00:00:00Z')
				].join(', ') +
				');'
		);
		fkCount++;
	}
}

lines.push('PRAGMA foreign_keys=ON;');
lines.push('');

const out = resolve(seedDir, 'seed.sql');
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(
	`Wrote ${out}\n  matters: ${matters.length}\n  work_products: ${items.length}\n  firm_knowledge: ${fkCount}\n  audit actions: ${audits.length}\n  last chain hash: ${prev.slice(0, 12)}…`
);
