// Client-safe row shapes (mirror the Drizzle schema). Components import these
// instead of the server schema types so no server-only module leaks into the client bundle.

export interface WorkProduct {
	id: string;
	type: 'draft' | 'memo' | 'risk_analysis';
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
	type: 'draft' | 'memo' | 'risk_analysis';
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
