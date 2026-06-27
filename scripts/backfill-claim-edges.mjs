/**
 * Backfill reasoning-graph edges for work products that have atomic claims but no
 * `claim_edge` rows. Such documents render "No dependencies mapped for this document"
 * in the workspace graph.
 *
 * This happens for work products ingested before the edge-derivation fix, and — before
 * the tiered-foundation fix in src/lib/server/claims.ts — for ANY live-ingested document
 * whose body carried no inline `[n]` citation markers (most real contracts/letters/memos).
 * The code fix only affects NEW ingests; this repairs documents already in the database.
 *
 * It is a faithful port of `deriveEdges` (src/lib/server/claims.ts), run over the claim
 * rows already stored (idx, kind, citation_markers) rather than re-splitting the body, so
 * a backfilled document gets exactly the edges a fresh ingest now would.
 *
 * Usage:
 *   node scripts/backfill-claim-edges.mjs --db <path-to-d1.sqlite> [--dry-run]
 *
 * If --db is omitted it auto-discovers the local D1 sqlite under .wrangler (preferring
 * the current repo root). Idempotent: only touches work products with claims and zero
 * edges, and only INSERTs claim_edge rows.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ORDERING_RELATIONS = new Set(['premise', 'definition', 'elaboration']);

/** A claim GROUNDS others when it invokes a cited authority (an inline `[n]` marker). */
function isFoundation(c) {
	return c.kind === 'citation_ref' || (c.citationMarkers?.length ?? 0) > 0;
}

/** Port of deriveEdges() — see src/lib/server/claims.ts. `claims` are {idx, kind, citationMarkers}. */
function deriveEdges(claims) {
	const cited = claims.filter(isFoundation).map((c) => c.idx);
	const assertions = claims.filter((c) => c.kind === 'assertion').map((c) => c.idx);
	const substantive = claims.filter((c) => c.kind !== 'boilerplate').map((c) => c.idx);
	const mode = cited.length ? 'citation' : assertions.length ? 'framing' : 'sequence';
	const foundations = mode === 'citation' ? cited : mode === 'framing' ? assertions : substantive;
	if (!foundations.length) return [];
	const foundationSet = new Set(foundations);

	const nearestFoundation = (idx) => {
		let best = null;
		let bestDist = Infinity;
		for (const f of foundations) {
			if (f === idx) continue;
			const dist = idx - f >= 0 ? idx - f : f - idx + 0.5;
			if (dist < bestDist) {
				bestDist = dist;
				best = f;
			}
		}
		return best;
	};
	const prevFoundation = (idx) => {
		let prev = null;
		for (const f of foundations) {
			if (f < idx) prev = f;
			else break;
		}
		return prev;
	};
	const elaborationRationale = (to) =>
		mode === 'citation'
			? `Develops the argument from the authority cited in claim ${to + 1}.`
			: mode === 'framing'
				? `Develops the framing established in claim ${to + 1}.`
				: `Follows in the document's reasoning from claim ${to + 1}.`;
	const premiseRationale = (to) =>
		mode === 'citation'
			? `Rests on the authority cited in claim ${to + 1}.`
			: `Rests on the framing established in claim ${to + 1}.`;

	const edges = [];
	for (const c of claims) {
		if (c.kind === 'boilerplate') continue;
		if (foundationSet.has(c.idx)) {
			const prev = prevFoundation(c.idx);
			if (prev != null)
				edges.push({
					fromIdx: c.idx,
					toIdx: prev,
					relation: 'elaboration',
					rationale: elaborationRationale(prev),
					ordering: ORDERING_RELATIONS.has('elaboration')
				});
		} else {
			const f = nearestFoundation(c.idx);
			if (f != null)
				edges.push({
					fromIdx: c.idx,
					toIdx: f,
					relation: 'premise',
					rationale: premiseRationale(f),
					ordering: ORDERING_RELATIONS.has('premise')
				});
		}
	}
	return edges;
}

// --- DB plumbing (sqlite3 CLI) ----------------------------------------------

function findDb() {
	const candidates = [process.cwd(), resolve(process.cwd(), '../../..')];
	for (const root of candidates) {
		const dir = join(root, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
		if (!existsSync(dir)) continue;
		const hit = readdirSync(dir).find((f) => f.endsWith('.sqlite'));
		if (hit) return join(dir, hit);
	}
	return null;
}

function query(db, sql) {
	const out = execFileSync('sqlite3', [db, '-json', sql], { encoding: 'utf8' }).trim();
	return out ? JSON.parse(out) : [];
}

function sqlStr(s) {
	return `'${String(s).replaceAll("'", "''")}'`;
}

// --- main -------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dbArg = args.indexOf('--db');
const db = dbArg >= 0 ? args[dbArg + 1] : findDb();

if (!db || !existsSync(db)) {
	console.error('No D1 sqlite found. Pass --db <path>.');
	process.exit(1);
}
console.log(`DB: ${db}${dryRun ? '  (dry run)' : ''}\n`);

const claims = query(
	db,
	'SELECT work_product_id, id, idx, kind, citation_markers FROM atomic_claim ORDER BY work_product_id, idx;'
);
const withEdges = new Set(
	query(db, 'SELECT DISTINCT work_product_id FROM claim_edge;').map((r) => r.work_product_id)
);

const byWp = new Map();
for (const c of claims) {
	if (!byWp.has(c.work_product_id)) byWp.set(c.work_product_id, []);
	byWp.get(c.work_product_id).push({
		id: c.id,
		idx: c.idx,
		kind: c.kind,
		citationMarkers: JSON.parse(c.citation_markers || '[]')
	});
}

const inserts = [];
let repaired = 0;
for (const [wpId, wpClaims] of byWp) {
	if (withEdges.has(wpId)) continue; // already has edges — leave it alone
	const byIdx = new Map(wpClaims.map((c) => [c.idx, c]));
	const edges = deriveEdges(wpClaims);
	if (!edges.length) {
		console.log(`· ${wpId}: ${wpClaims.length} claims → 0 edges (no anchor, skipped)`);
		continue;
	}
	repaired++;
	console.log(`✓ ${wpId}: ${wpClaims.length} claims → ${edges.length} edges`);
	edges.forEach((e, i) => {
		const from = byIdx.get(e.fromIdx)?.id;
		const to = byIdx.get(e.toIdx)?.id;
		if (!from || !to) return;
		inserts.push(
			`INSERT INTO claim_edge (id, work_product_id, from_claim_id, to_claim_id, relation, rationale, is_ordering, created_at) VALUES (` +
				[
					sqlStr(`${wpId}_bf_edge${i}`),
					sqlStr(wpId),
					sqlStr(from),
					sqlStr(to),
					sqlStr(e.relation),
					sqlStr(e.rationale),
					e.ordering ? 1 : 0,
					'CURRENT_TIMESTAMP'
				].join(', ') +
				');'
		);
	});
}

console.log(
	`\n${repaired} work product(s) to repair, ${inserts.length} edge(s) to insert.`
);

if (!inserts.length || dryRun) {
	if (dryRun && inserts.length) console.log('\n--- SQL (dry run, not applied) ---\n' + inserts.join('\n'));
	process.exit(0);
}

execFileSync('sqlite3', [db], { input: inserts.join('\n') + '\n', encoding: 'utf8' });
console.log('Applied.');
