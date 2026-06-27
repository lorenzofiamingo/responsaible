import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { FigureTrace, SupervisorInput } from '$lib/types';

// Better Auth tables (user/session/account/verification) — co-located so one
// migration + one Drizzle client cover both auth and the domain model.
export * from './auth-schema';

/**
 * Itaily Oversight — data model.
 *
 * A `work_product` is one AI-generated deliverable (draft / memo / opinion / risk analysis).
 * Each carries a transparency `agent_action` trace, `citation`s (resolvable against
 * EU CELLAR), `risk_signal`s, and an insert-only, hash-chained `supervisory_action`
 * audit log. The audit log is the defensible supervisory trail.
 */

export const workProduct = sqliteTable(
	'work_product',
	{
		id: text('id').primaryKey(),
		type: text('type', { enum: ['draft', 'memo', 'opinion', 'risk_analysis'] }).notNull(),
		title: text('title').notNull(),
		summary: text('summary').notNull().default(''),
		/** Markdown-ish body. Citation markers like [1] reference `citation.marker`. */
		body: text('body').notNull().default(''),
		matterRef: text('matter_ref').notNull().default(''),
		matterName: text('matter_name').notNull().default(''),
		/** Which AI agent/pipeline produced it (display label). */
		agentName: text('agent_name').notNull().default(''),
		status: text('status', {
			enum: ['pending', 'approved', 'amended', 'rejected', 'rework', 'escalated']
		})
			.notNull()
			.default('pending'),
		/** Higher = more urgent. Combined with confidence for queue ordering. */
		priority: integer('priority').notNull().default(0),
		/** 0..1 — the AI's self-reported confidence in the work product. */
		confidence: real('confidence').notNull().default(0),
		model: text('model').notNull().default(''),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(CURRENT_TIMESTAMP)`)
	},
	(t) => [index('wp_status_idx').on(t.status), index('wp_priority_idx').on(t.priority)]
);

export const agentAction = sqliteTable(
	'agent_action',
	{
		id: text('id').primaryKey(),
		workProductId: text('work_product_id')
			.notNull()
			.references(() => workProduct.id),
		step: integer('step').notNull(),
		kind: text('kind', {
			enum: ['search', 'retrieve', 'reason', 'draft', 'cite', 'critique']
		}).notNull(),
		/** The sub-agent that performed the step (e.g. "research", "drafter", "critic"). */
		actorAgent: text('actor_agent').notNull().default(''),
		summary: text('summary').notNull(),
		/** Free-form structured detail (tool input/output, reasoning) from ADK events. */
		detail: text('detail', { mode: 'json' }).$type<Record<string, unknown> | null>(),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(CURRENT_TIMESTAMP)`)
	},
	(t) => [index('aa_wp_idx').on(t.workProductId)]
);

export const citation = sqliteTable(
	'citation',
	{
		id: text('id').primaryKey(),
		workProductId: text('work_product_id')
			.notNull()
			.references(() => workProduct.id),
		/** The [n] marker used inline in the work-product body. */
		marker: integer('marker'),
		claim: text('claim').notNull().default(''),
		/** EU CELLAR identifiers. CELEX is canonical; ELI/URL are derived. */
		celex: text('celex'),
		eli: text('eli'),
		title: text('title').notNull().default(''),
		sourceUrl: text('source_url'),
		snippet: text('snippet').notNull().default(''),
		/** Pinpoint within the act, e.g. "Art. 6(1)(f)". */
		locator: text('locator').notNull().default(''),
		supportsClaim: integer('supports_claim', { mode: 'boolean' }).notNull().default(true),
		verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
		verifyStatus: text('verify_status', { enum: ['unchecked', 'verified', 'unresolved'] })
			.notNull()
			.default('unchecked'),
		verifiedAt: text('verified_at')
	},
	(t) => [index('cit_wp_idx').on(t.workProductId)]
);

export const riskSignal = sqliteTable(
	'risk_signal',
	{
		id: text('id').primaryKey(),
		workProductId: text('work_product_id')
			.notNull()
			.references(() => workProduct.id),
		category: text('category', {
			enum: ['hallucination', 'jurisdiction', 'missing_authority', 'conflict', 'deadline']
		}).notNull(),
		severity: text('severity', { enum: ['low', 'med', 'high'] }).notNull(),
		rationale: text('rationale').notNull(),
		confidence: real('confidence').notNull().default(0)
	},
	(t) => [index('rs_wp_idx').on(t.workProductId)]
);

/**
 * Atomic claims — the document body, split by the first ADK agent into the
 * smallest independently-verifiable text units. Each claim carries its source
 * span (offsets into `work_product.body`), an auto-assigned work-group preset,
 * and its analysis result. The analysis columns are seeded offline by the ADK
 * pipeline; a live per-claim run (see /api/.../analyze) overwrites them and also
 * doubles as the cached fallback when no model key is configured.
 *
 * NOT the same as `citation.claim` (the proposition a citation supports).
 * This is a normal mutable domain table — only `supervisory_action` is insert-only.
 */
export const atomicClaim = sqliteTable(
	'atomic_claim',
	{
		id: text('id').primaryKey(),
		workProductId: text('work_product_id')
			.notNull()
			.references(() => workProduct.id),
		/** 0-based order within the document. */
		idx: integer('idx').notNull(),
		text: text('text').notNull().default(''),
		/** Span into `work_product.body` for left-column highlighting. */
		charStart: integer('char_start').notNull().default(0),
		charEnd: integer('char_end').notNull().default(0),
		kind: text('kind', {
			enum: ['heading', 'recital', 'obligation', 'definition', 'citation_ref', 'assertion', 'boilerplate']
		})
			.notNull()
			.default('assertion'),
		/** Work-group preset auto-assigned to this claim by the splitter. */
		assignedPreset: text('assigned_preset', {
			enum: ['quick_scan', 'standard_review', 'authority_deep_dive']
		})
			.notNull()
			.default('standard_review'),
		status: text('status', { enum: ['pending', 'running', 'analyzed'] })
			.notNull()
			.default('pending'),
		// --- analysis (seeded baseline / live result / cached fallback) ---
		/** null until the supervisor runs it; then 'seed' (fallback) or 'live'. */
		analysisSource: text('analysis_source', { enum: ['seed', 'live'] }),
		/** The preset id actually run (may differ from `assignedPreset`). */
		presetUsed: text('preset_used').notNull().default(''),
		/** The resolved figure config (model+effort per figure) used for the run. */
		workGroupJson: text('work_group_json', { mode: 'json' }).$type<unknown | null>(),
		verdict: text('verdict', { enum: ['supported', 'weak', 'unsupported', 'flag'] }),
		analysisSummary: text('analysis_summary').notNull().default(''),
		confidence: real('confidence').notNull().default(0),
		riskCategory: text('risk_category', {
			enum: ['hallucination', 'jurisdiction', 'missing_authority', 'conflict', 'deadline']
		}),
		riskSeverity: text('risk_severity', { enum: ['low', 'med', 'high'] }),
		riskRationale: text('risk_rationale').notNull().default(''),
		/** Document-level `citation.marker`s this claim relies on. */
		citationMarkers: text('citation_markers', { mode: 'json' }).$type<number[] | null>(),
		/** Per-figure trace of what each ADK figure did for this claim. */
		figureTrace: text('figure_trace', { mode: 'json' }).$type<FigureTrace[] | null>(),
		ranAt: text('ran_at'),
		// --- supervisor overrides (manual, layered on top of the AI analysis) ---
		// The supervisor can override the AI's verdict by hand and re-run the work
		// group with their own guidance/sources. These are mutable domain columns;
		// each override is ALSO appended to the insert-only audit chain for defensibility.
		/** The supervisor's manual verdict, overriding the AI's. null ⇒ no override. */
		reviewVerdict: text('review_verdict', { enum: ['supported', 'weak', 'unsupported', 'flag'] }),
		/** Optional written reason for the manual verdict. */
		reviewNote: text('review_note').notNull().default(''),
		/** Who set the manual verdict (actor email), and when (ISO). */
		reviewedBy: text('reviewed_by'),
		reviewedAt: text('reviewed_at'),
		/** Manual guidance / sources the supervisor last ran the work group with. */
		supervisorInput: text('supervisor_input', { mode: 'json' }).$type<SupervisorInput | null>(),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(CURRENT_TIMESTAMP)`)
	},
	(t) => [index('claim_wp_idx').on(t.workProductId)]
);

/**
 * Typed dependency / consistency edges between atomic claims — the reasoning graph
 * the claim-grapher ADK agent builds after the splitter. Two families:
 *   - ORDERING (premise | definition | elaboration): directed, acyclic. `from`
 *     RESTS ON `to`; a weak/unsupported `to` propagates risk up to `from`
 *     (a conclusion can't be more reliable than the premise it stands on).
 *   - LATERAL (qualification | conflict): not part of the ordering; surfaced to the
 *     supervisor for consistency review (a caveat that narrows a claim, or a
 *     potential contradiction). `is_ordering` records which family an edge is in.
 *
 * Risk propagation itself is computed client-side from these edges + the live
 * per-claim results (see src/lib/claim-graph.ts), so the runtime analyzer stays
 * per-claim and the graph reacts as each claim is analyzed.
 */
export const claimEdge = sqliteTable(
	'claim_edge',
	{
		id: text('id').primaryKey(),
		workProductId: text('work_product_id')
			.notNull()
			.references(() => workProduct.id),
		/** The DEPENDENT claim (rests on `toClaimId`). */
		fromClaimId: text('from_claim_id')
			.notNull()
			.references(() => atomicClaim.id),
		/** The claim depended upon (the premise / target). */
		toClaimId: text('to_claim_id')
			.notNull()
			.references(() => atomicClaim.id),
		relation: text('relation', {
			enum: ['premise', 'definition', 'elaboration', 'qualification', 'conflict']
		}).notNull(),
		rationale: text('rationale').notNull().default(''),
		/** True for the ordering family (premise/definition/elaboration) that propagates risk. */
		ordering: integer('is_ordering', { mode: 'boolean' }).notNull().default(true),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(CURRENT_TIMESTAMP)`)
	},
	(t) => [index('edge_wp_idx').on(t.workProductId), index('edge_from_idx').on(t.fromClaimId)]
);

/**
 * The audit log — INSERT-ONLY. Never UPDATE or DELETE these rows.
 * Each row is hash-chained: hash = sha256(prevHash + workProductId + actorEmail +
 * action + reason + createdAt). `/api/audit/verify` recomputes the chain to prove
 * tamper-evidence. The genesis row's prevHash is a fixed constant.
 */
export const supervisoryAction = sqliteTable(
	'supervisory_action',
	{
		id: text('id').primaryKey(),
		workProductId: text('work_product_id')
			.notNull()
			.references(() => workProduct.id),
		actorEmail: text('actor_email').notNull(),
		action: text('action', {
			enum: ['approve', 'amend', 'reject', 'request_rework', 'escalate', 'override']
		}).notNull(),
		reason: text('reason').notNull().default(''),
		prevHash: text('prev_hash').notNull(),
		hash: text('hash').notNull(),
		createdAt: text('created_at').notNull()
	},
	(t) => [index('sa_wp_idx').on(t.workProductId), index('sa_created_idx').on(t.createdAt)]
);

/**
 * The firm's private knowledge base — internal memos, precedents, and playbook
 * clauses the Knowledge researcher figure draws on. This is confidential / privileged
 * material: retrieval is lexical and on-perimeter (no external embedding call), and
 * the figure reasons over it with an open, self-hostable model so nothing leaves.
 */
export const firmKnowledge = sqliteTable(
	'firm_knowledge',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		/** memo | precedent | playbook | guidance — coarse bucket for display. */
		category: text('category').notNull().default('memo'),
		/** Full text searched lexically at runtime. */
		body: text('body').notNull().default(''),
		/** Space/comma-separated topical tags to boost lexical matches. */
		tags: text('tags').notNull().default(''),
		/** Internal reference shown in the trace (no public URL — it is private). */
		sourceRef: text('source_ref').notNull().default(''),
		createdAt: text('created_at').notNull()
	},
	(t) => [index('fk_category_idx').on(t.category)]
);

export type WorkProduct = typeof workProduct.$inferSelect;
export type AgentAction = typeof agentAction.$inferSelect;
export type Citation = typeof citation.$inferSelect;
export type RiskSignal = typeof riskSignal.$inferSelect;
export type AtomicClaim = typeof atomicClaim.$inferSelect;
export type ClaimEdge = typeof claimEdge.$inferSelect;
export type SupervisoryAction = typeof supervisoryAction.$inferSelect;
export type FirmKnowledge = typeof firmKnowledge.$inferSelect;
