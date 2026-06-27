import { CAN_SUPERVISE } from '$lib/format';
import { analyzeClaimLive } from '$lib/server/analyze';
import { dbFrom } from '$lib/server/db/client';
import { getClaims, recordClaimRun, type ClaimRunUpdate } from '$lib/server/db/queries';
import { citation } from '$lib/server/db/schema';
import type { AtomicClaim, Citation } from '$lib/server/db/schema';
import {
	figureTools,
	resolveWorkGroup,
	type Figure,
	type PresetId,
	type ResearchTool,
	type WorkGroup
} from '$lib/workgroups';
import type { FigureTrace, SupervisorInput, TraceSource } from '$lib/types';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

interface AnalyzeRequest {
	claimIds?: 'all' | string[];
	workGroups?: Record<string, { preset?: PresetId; figures?: Figure[] }>;
	/** Per-claim manual guidance / sources the supervisor inserted for this run. */
	supervisorInputs?: Record<string, SupervisorInput>;
	/** Force the seeded fallback (skip live models) — used by the offline demo. */
	offline?: boolean;
}

/** Drop empty parts of a supervisor input; null when nothing usable remains. */
function trimSupervisorInput(input: SupervisorInput | null | undefined): SupervisorInput | null {
	if (!input) return null;
	const guidance = (input.guidance ?? '').trim();
	const sources = (input.sources ?? [])
		.map((s) => ({
			celex: (s.celex ?? '').trim() || undefined,
			title: (s.title ?? '').trim() || undefined,
			locator: (s.locator ?? '').trim() || undefined,
			snippet: (s.snippet ?? '').trim() || undefined,
			url: (s.url ?? '').trim() || undefined
		}))
		.filter((s) => s.celex || s.title || s.snippet || s.url);
	if (!guidance && sources.length === 0) return null;
	return { guidance: guidance || undefined, sources };
}

const CONCURRENCY = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const effortWeight = { low: 1, med: 2, high: 3 } as const;

/** A plausible per-figure trace for the seeded fallback (no live call was made). */
function synthFigureTrace(
	group: WorkGroup,
	claim: AtomicClaim,
	docCitations: Citation[],
	input: SupervisorInput | null
): FigureTrace[] {
	const markers = claim.citationMarkers ?? [];
	const cellarSources: TraceSource[] = docCitations
		.filter((c) => c.marker != null && markers.includes(c.marker))
		.map((c) => ({ title: `[${c.marker}] ${c.title}`, url: c.sourceUrl ?? undefined }));
	const supN = input?.sources?.length ?? 0;
	const supNote = supN ? ` (incl. ${supN} supervisor-provided, not re-resolved offline)` : '';
	const ms = (f: Figure) => 150 + effortWeight[f.effort] * 120;

	const out: FigureTrace[] = [];
	for (const f of group.figures) {
		if (f.role === 'research') {
			const tools = figureTools(f).length ? figureTools(f) : (['cellar'] as ResearchTool[]);
			for (const t of tools) {
				if (t === 'web') {
					out.push({ role: f.role, model: f.model, effort: f.effort, kind: 'search', tool: t, summary: 'Open-web research is skipped in the offline/seeded run.', ms: ms(f) });
				} else if (t === 'knowledge') {
					out.push({ role: f.role, model: f.model, effort: f.effort, kind: 'retrieve', tool: t, summary: 'Firm knowledge is consulted only on a live run.', ms: ms(f) });
				} else {
					out.push({
						role: f.role,
						model: f.model,
						effort: f.effort,
						kind: 'retrieve',
						tool: t,
						summary:
							markers.length || supN
								? `Re-checked ${markers.length + supN} cited authority(ies)${supNote} from the seeded grounding.`
								: 'No inline authority to ground for this claim.',
						sources: cellarSources,
						ms: ms(f)
					});
				}
			}
			continue;
		}
		out.push({
			role: f.role,
			model: f.model,
			effort: f.effort,
			kind: f.role === 'drafter' ? 'draft' : 'critique',
			summary:
				f.role === 'critic'
					? (input?.guidance ? `Applied the supervisor’s instruction. ` : '') +
						(claim.analysisSummary || 'Reviewed the claim against its seeded baseline.')
					: f.desc,
			ms: ms(f)
		});
	}
	return out;
}

export const POST: RequestHandler = async ({ request, params, platform, locals }) => {
	if (!locals.user || !CAN_SUPERVISE.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can run the analysis.' }, { status: 403 });
	}

	const db = dbFrom(platform);
	const env = platform?.env;
	const kv = platform?.env?.KV;

	const body = (await request.json().catch(() => ({}))) as AnalyzeRequest;

	const allClaims = await getClaims(db, params.id);
	const targetSet = body.claimIds === 'all' || body.claimIds == null ? null : new Set(body.claimIds);
	const claims = targetSet ? allClaims.filter((c) => targetSet.has(c.id)) : allClaims;
	if (claims.length === 0) {
		return json({ error: 'No matching claims to analyze.' }, { status: 400 });
	}

	const docCitations = await db.select().from(citation).where(eq(citation.workProductId, params.id)).all();
	const workGroups = body.workGroups ?? {};
	const supervisorInputs = body.supervisorInputs ?? {};
	const forceOffline = body.offline === true || !env;

	async function processClaim(claim: AtomicClaim) {
		const group = resolveWorkGroup(workGroups[claim.id], claim.assignedPreset as PresetId);
		// Per-claim manual input: prefer what the panel sent; otherwise reuse what was
		// last saved on the claim so a plain "Run all" still honours earlier inputs.
		const supervisorInput =
			trimSupervisorInput(supervisorInputs[claim.id]) ?? trimSupervisorInput(claim.supervisorInput);

		let source: 'live' | 'seed' = 'seed';
		let verdict = claim.verdict;
		let confidence = claim.confidence;
		let summary = claim.analysisSummary;
		let riskCategory = claim.riskCategory;
		let riskSeverity = claim.riskSeverity;
		let riskRationale = claim.riskRationale;
		let citationMarkers = claim.citationMarkers ?? [];
		let figureTrace: FigureTrace[] = synthFigureTrace(group, claim, docCitations, supervisorInput);
		let usedInput: SupervisorInput | null = supervisorInput;

		if (!forceOffline && env) {
			try {
				const live = await analyzeClaimLive({
					claimText: claim.text,
					docCitations,
					group,
					env,
					kv,
					db,
					supervisorInput
				});
				source = 'live';
				verdict = live.verdict;
				confidence = live.confidence;
				summary = live.summary;
				riskCategory = live.riskCategory as AtomicClaim['riskCategory'];
				riskSeverity = live.riskSeverity as AtomicClaim['riskSeverity'];
				riskRationale = live.riskRationale;
				citationMarkers = live.citationMarkers;
				figureTrace = live.figureTrace;
				usedInput = live.supervisorInput ?? supervisorInput;
			} catch {
				source = 'seed';
			}
		}

		if (source === 'seed') {
			// Make the seeded reveal feel like work proportional to the group's cost.
			const cost = group.figures.reduce((n, f) => n + effortWeight[f.effort], 0);
			await sleep(Math.min(2200, Math.max(300, 200 * group.figures.length + cost * 160)));
		}

		const ranAt = new Date().toISOString();
		const update: ClaimRunUpdate = {
			analysisSource: source,
			presetUsed: group.id,
			workGroupJson: group,
			verdict,
			analysisSummary: summary,
			confidence,
			riskCategory,
			riskSeverity,
			riskRationale,
			citationMarkers,
			figureTrace,
			supervisorInput: usedInput
		};
		await recordClaimRun(db, claim.id, update);

		return {
			claimId: claim.id,
			idx: claim.idx,
			status: 'analyzed' as const,
			analysisSource: source,
			presetUsed: group.id,
			verdict,
			analysisSummary: summary,
			confidence,
			riskCategory,
			riskSeverity,
			riskRationale,
			citationMarkers,
			figureTrace,
			ranAt,
			supervisorInput: usedInput
		};
	}

	// Stream NDJSON — one line per claim as it completes, with bounded concurrency
	// so "run all" reveals progressively (and never exceeds the model's rate limits).
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			let next = 0;
			async function worker() {
				while (next < claims.length) {
					const claim = claims[next++];
					try {
						const result = await processClaim(claim);
						controller.enqueue(encoder.encode(JSON.stringify(result) + '\n'));
					} catch (err) {
						controller.enqueue(
							encoder.encode(
								JSON.stringify({ claimId: claim.id, idx: claim.idx, status: 'error', error: String(err) }) + '\n'
							)
						);
					}
				}
			}
			await Promise.all(Array.from({ length: Math.min(CONCURRENCY, claims.length) }, worker));
			controller.close();
		}
	});

	return new Response(stream, {
		headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' }
	});
};
