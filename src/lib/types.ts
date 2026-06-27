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
