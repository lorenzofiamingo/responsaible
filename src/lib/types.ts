// Client-safe row shapes (mirror the Drizzle schema). Components import these
// instead of the server schema types so no server-only module leaks into the client bundle.

export interface WorkProduct {
	id: string;
	type: 'draft' | 'memo' | 'opinion' | 'risk_analysis';
	title: string;
	summary: string;
	body: string;
	matterRef: string;
	matterName: string;
	agentName: string;
	status: string;
	priority: number;
	confidence: number;
	model: string;
	createdAt: string;
}

export interface AgentAction {
	id: string;
	workProductId: string;
	step: number;
	kind: string;
	actorAgent: string;
	summary: string;
	detail: Record<string, unknown> | null;
	createdAt: string;
}

export interface Citation {
	id: string;
	workProductId: string;
	marker: number | null;
	claim: string;
	celex: string | null;
	eli: string | null;
	title: string;
	sourceUrl: string | null;
	snippet: string;
	locator: string;
	supportsClaim: boolean;
	verified: boolean;
	verifyStatus: string;
	verifiedAt: string | null;
}

export interface RiskSignal {
	id: string;
	workProductId: string;
	category: string;
	severity: string;
	rationale: string;
	confidence: number;
}

export interface SupervisoryAction {
	id: string;
	workProductId: string;
	actorEmail: string;
	action: string;
	reason: string;
	prevHash: string;
	hash: string;
	createdAt: string;
}

// --- Document intake / AI extraction --------------------------------------------
// Shape returned by POST /api/work-products/extract. It is a review-ready DRAFT
// (not yet persisted): the /new page binds these fields directly so a supervisor
// can correct anything before submitting. A superset of the create payload.

export interface ExtractedCitation {
	marker: number;
	claim: string;
	celex: string | null;
	eli: string | null;
	title: string;
	sourceUrl: string | null;
	snippet: string;
	locator: string;
	supportsClaim: boolean;
}

export interface ExtractedRisk {
	category: 'hallucination' | 'jurisdiction' | 'missing_authority' | 'conflict' | 'deadline';
	severity: 'low' | 'med' | 'high';
	rationale: string;
	confidence: number;
}

export interface ExtractedTraceStep {
	step: number;
	kind: 'search' | 'retrieve' | 'reason' | 'draft' | 'cite' | 'critique';
	actorAgent: string;
	summary: string;
	detail?: Record<string, unknown> | null;
}

export interface ExtractedDraft {
	type: 'draft' | 'memo' | 'opinion' | 'risk_analysis';
	title: string;
	summary: string;
	body: string;
	matterName: string;
	matterRef: string;
	agentName: string;
	priority: number;
	confidence: number;
	model: string;
	citations: ExtractedCitation[];
	riskSignals: ExtractedRisk[];
	trace: ExtractedTraceStep[];
	meta: {
		/** Which engine produced this draft. */
		method: 'rules' | 'gemini';
		/** Whether the source was plain text, a parsed PDF, or a parsed Word doc. */
		sourceKind: 'text' | 'pdf' | 'docx';
		/** Character count of the source text the analysis ran on. */
		chars: number;
		/** Non-fatal notes surfaced to the operator (e.g. "no authority detected"). */
		warnings: string[];
	};
}

/** What one ADK figure did for a claim during analysis. */
export interface FigureTrace {
	role: string;
	model: string;
	effort: string;
	/** A TRACE_KIND value: search | retrieve | reason | draft | cite | critique. */
	kind: string;
	summary: string;
	/** Wall-clock the figure took, ms. */
	ms: number;
	/** Which research tool produced this step: cellar | web | knowledge. */
	tool?: string;
	/** Sources the tool surfaced (authorities, web pages, or firm documents). */
	sources?: TraceSource[];
}

/** A source a research tool surfaced — a CELLAR authority, web page, or firm doc. */
export interface TraceSource {
	title: string;
	/** External link (EUR-Lex / web). Absent for private firm-knowledge sources. */
	url?: string;
	/** Internal reference (e.g. firm-knowledge doc id) when there is no public URL. */
	ref?: string;
}

/** An atomic claim: a verifiable text unit split out of the work-product body. */
export interface AtomicClaim {
	id: string;
	workProductId: string;
	idx: number;
	text: string;
	charStart: number;
	charEnd: number;
	kind: string;
	assignedPreset: string;
	status: string;
	analysisSource: string | null;
	presetUsed: string;
	workGroupJson: unknown | null;
	verdict: string | null;
	analysisSummary: string;
	confidence: number;
	riskCategory: string | null;
	riskSeverity: string | null;
	riskRationale: string;
	citationMarkers: number[] | null;
	figureTrace: FigureTrace[] | null;
	ranAt: string | null;
	createdAt: string;
}

/** How one atomic claim relates to another in the reasoning graph. */
export type ClaimRelation = 'premise' | 'definition' | 'elaboration' | 'qualification' | 'conflict';

/** A typed edge between two atomic claims. `from` RESTS ON `to`. */
export interface ClaimEdge {
	id: string;
	workProductId: string;
	/** The dependent claim. */
	fromClaimId: string;
	/** The claim depended upon (premise / target). */
	toClaimId: string;
	relation: ClaimRelation;
	rationale: string;
	/** True for the ordering family (premise/definition/elaboration) that propagates risk. */
	ordering: boolean;
	createdAt: string;
}

/** The per-claim result returned by POST /api/work-products/[id]/analyze. */
export interface ClaimRunResult {
	claimId: string;
	idx: number;
	status: 'analyzed';
	analysisSource: 'seed' | 'live';
	presetUsed: string;
	verdict: string | null;
	analysisSummary: string;
	confidence: number;
	riskCategory: string | null;
	riskSeverity: string | null;
	riskRationale: string;
	citationMarkers: number[];
	figureTrace: FigureTrace[];
	ranAt: string;
}
