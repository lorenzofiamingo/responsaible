import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Itaily Oversight — data model.
 *
 * A `work_product` is one AI-generated deliverable (draft / memo / risk analysis).
 * Each carries a transparency `agent_action` trace, `citation`s (resolvable against
 * EU CELLAR), `risk_signal`s, and an insert-only, hash-chained `supervisory_action`
 * audit log. The audit log is the defensible supervisory trail.
 */

export const workProduct = sqliteTable(
	'work_product',
	{
		id: text('id').primaryKey(),
		type: text('type', { enum: ['draft', 'memo', 'risk_analysis'] }).notNull(),
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

export type WorkProduct = typeof workProduct.$inferSelect;
export type AgentAction = typeof agentAction.$inferSelect;
export type Citation = typeof citation.$inferSelect;
export type RiskSignal = typeof riskSignal.$inferSelect;
export type SupervisoryAction = typeof supervisoryAction.$inferSelect;
