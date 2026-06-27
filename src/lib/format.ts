// Shared presentation maps: enum value → human label, Lucide icon name, Badge tone.
// Keeping these in one place stops the queue/detail views from drifting apart.

export type Tone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

// The four kinds of AI work product the supervisor triages. `desc` is the one-line
// explainer surfaced in the type-badge tooltip (queue row + document header).
export const WP_TYPE = {
	draft: {
		label: 'Draft',
		icon: 'pencil',
		desc: 'A working draft the AI produced — such as a clause, agreement, or filing — for the supervisor to refine before it is finalised.'
	},
	memo: {
		label: 'Memo',
		icon: 'file-text',
		desc: 'An internal legal memorandum: research and analysis prepared for use inside the firm, not addressed to an outside party.'
	},
	// An external, reliance-bearing legal opinion — the highest sign-off stakes,
	// so it reads distinctly (gavel) from the internal memo it is NOT.
	opinion: {
		label: 'Opinion',
		icon: 'gavel',
		desc: 'A formal legal opinion a client or third party may rely on — the highest sign-off stakes, so it is held to the strictest review.'
	},
	risk_analysis: {
		label: 'Risk analysis',
		icon: 'shield-alert',
		desc: 'A structured assessment of legal risk and exposure, flagging where the matter could go wrong and how serious it is.'
	}
} as const;

/**
 * Provenance of a claim's assessment, keyed by the stored `analysis_source` enum.
 * Exactly two states reach the UI: `live` (a successful model run this session) and
 * `seed`, shown as "baseline" — the analysis pre-computed offline when the work
 * product was ingested, also used as the fallback when a live re-run can't reach a model.
 */
export const ANALYSIS_SOURCE: Record<'seed' | 'live', { label: string; icon: string; desc: string }> = {
	seed: {
		label: 'baseline',
		icon: 'history',
		desc: 'Pre-computed offline by the agent pipeline when this work product was ingested. Always available with no network — and the fallback shown when a live re-run can’t reach a model.'
	},
	live: {
		label: 'live',
		icon: 'sparkles',
		desc: 'A fresh run of the chosen work group against this claim, grounding each cited authority against the live EU CELLAR (EUR-Lex) database at review time.'
	}
};

export const STATUS: Record<string, { label: string; tone: Tone; icon: string }> = {
	pending: { label: 'Pending review', tone: 'warning', icon: 'clock' },
	approved: { label: 'Approved', tone: 'success', icon: 'circle-check' },
	amended: { label: 'Amended', tone: 'info', icon: 'pencil' },
	rejected: { label: 'Rejected', tone: 'danger', icon: 'circle-x' },
	rework: { label: 'Rework requested', tone: 'warning', icon: 'rotate-ccw' },
	escalated: { label: 'Escalated', tone: 'accent', icon: 'circle-arrow-up' }
};

// A matter's lifecycle state — shown as a badge on the matters list and detail.
export const MATTER_STATUS: Record<string, { label: string; tone: Tone; icon: string }> = {
	open: { label: 'Open', tone: 'success', icon: 'folder-open' },
	closed: { label: 'Closed', tone: 'neutral', icon: 'folder' }
};

export const SEVERITY: Record<string, { label: string; tone: Tone }> = {
	high: { label: 'High', tone: 'danger' },
	med: { label: 'Medium', tone: 'warning' },
	low: { label: 'Low', tone: 'neutral' }
};

export const RISK_CATEGORY: Record<string, { label: string; icon: string }> = {
	hallucination: { label: 'Hallucination', icon: 'triangle-alert' },
	jurisdiction: { label: 'Jurisdiction', icon: 'map-pin' },
	missing_authority: { label: 'Missing authority', icon: 'file-search' },
	conflict: { label: 'Conflict', icon: 'git-fork' },
	deadline: { label: 'Deadline', icon: 'calendar-clock' }
};

export const ACTION: Record<string, { label: string; icon: string; tone: Tone }> = {
	approve: { label: 'Approve', icon: 'circle-check', tone: 'success' },
	amend: { label: 'Amend', icon: 'pencil', tone: 'info' },
	reject: { label: 'Reject', icon: 'circle-x', tone: 'danger' },
	request_rework: { label: 'Request rework', icon: 'rotate-ccw', tone: 'warning' },
	escalate: { label: 'Escalate', icon: 'circle-arrow-up', tone: 'accent' },
	override: { label: 'Override', icon: 'ban', tone: 'danger' }
};

/** Actions that require a written reason before they can be recorded. */
export const REASON_REQUIRED = new Set(['reject', 'request_rework', 'escalate', 'override']);

export const TRACE_KIND: Record<string, { label: string; icon: string }> = {
	search: { label: 'Search', icon: 'search' },
	retrieve: { label: 'Retrieve', icon: 'book-open' },
	reason: { label: 'Reason', icon: 'brain' },
	draft: { label: 'Draft', icon: 'pencil' },
	cite: { label: 'Cite', icon: 'quote' },
	critique: { label: 'Critique', icon: 'shield-alert' }
};

export const VERIFY: Record<string, { label: string; tone: Tone; icon: string }> = {
	unchecked: { label: 'Unverified', tone: 'neutral', icon: 'circle-alert' },
	verified: { label: 'Verified', tone: 'success', icon: 'shield-check' },
	unresolved: { label: 'Unresolved', tone: 'danger', icon: 'circle-x' }
};

// --- Atomic-claim work area ---

export const CLAIM_KIND: Record<string, { label: string; icon: string }> = {
	heading: { label: 'Heading', icon: 'file-text' },
	recital: { label: 'Recital', icon: 'book-open' },
	obligation: { label: 'Obligation', icon: 'scale' },
	definition: { label: 'Definition', icon: 'quote' },
	citation_ref: { label: 'Citation', icon: 'gavel' },
	assertion: { label: 'Assertion', icon: 'list-checks' },
	boilerplate: { label: 'Boilerplate', icon: 'file-text' }
};

export const CLAIM_STATUS: Record<string, { label: string; tone: Tone; icon: string }> = {
	pending: { label: 'Not analyzed', tone: 'neutral', icon: 'circle-alert' },
	running: { label: 'Analyzing', tone: 'accent', icon: 'sparkles' },
	analyzed: { label: 'Analyzed', tone: 'success', icon: 'circle-check' }
};

/**
 * Claim-to-claim relations. `outbound` is read from the DEPENDENT's side
 * ("this claim → that one"); `inbound` from the depended-upon side
 * ("that claim → this one"). `ordering` marks the risk-propagating family.
 */
export const CLAIM_RELATION: Record<
	string,
	{ label: string; outbound: string; inbound: string; icon: string; ordering: boolean; tone: Tone }
> = {
	premise: {
		label: 'Premise',
		outbound: 'Rests on',
		inbound: 'Supports',
		icon: 'arrow-up-right',
		ordering: true,
		tone: 'info'
	},
	definition: {
		label: 'Definition',
		outbound: 'Uses term defined in',
		inbound: 'Defines term for',
		icon: 'quote',
		ordering: true,
		tone: 'info'
	},
	elaboration: {
		label: 'Elaboration',
		outbound: 'Elaborates',
		inbound: 'Elaborated by',
		icon: 'git-branch',
		ordering: true,
		tone: 'info'
	},
	qualification: {
		label: 'Qualification',
		outbound: 'Qualifies',
		inbound: 'Qualified by',
		icon: 'git-fork',
		ordering: false,
		tone: 'warning'
	},
	conflict: {
		label: 'Potential conflict',
		outbound: 'May conflict with',
		inbound: 'May conflict with',
		icon: 'triangle-alert',
		ordering: false,
		tone: 'danger'
	}
};

export const VERDICT: Record<string, { label: string; tone: Tone; icon: string }> = {
	supported: { label: 'Supported', tone: 'success', icon: 'circle-check' },
	weak: { label: 'Weakly supported', tone: 'warning', icon: 'triangle-alert' },
	unsupported: { label: 'Unsupported', tone: 'danger', icon: 'circle-x' },
	flag: { label: 'Flagged', tone: 'danger', icon: 'shield-alert' }
};

// The supervisor works claim-by-claim: each claim rolls up to one of four review
// states, and the work product's overall verdict is an aggregate of these. Kept
// here so SummaryOverview, ClaimFindings and the work area can't drift apart.
export type ClaimState = 'attention' | 'caution' | 'unrun' | 'clear';

export const CLAIM_STATE: Record<ClaimState, { label: string; tone: Tone; icon: string }> = {
	attention: { label: 'Needs attention', tone: 'danger', icon: 'shield-alert' },
	caution: { label: 'Review', tone: 'warning', icon: 'triangle-alert' },
	unrun: { label: 'Not yet run', tone: 'neutral', icon: 'circle-alert' },
	clear: { label: 'Clear', tone: 'success', icon: 'circle-check' }
};

/** Optional cross-claim propagation context (from src/lib/claim-graph.ts): is this
 *  claim undermined by a premise it rests on, and how badly? */
export interface ClaimStateInfo {
	undermined?: boolean;
	inheritedVerdict?: string | null;
}

/** Roll a single claim up to its review state (structural subset of AtomicClaim).
 *  Pass `info` to fold in the reasoning graph: a claim that rests on a broken premise
 *  is escalated even when it is individually fine, so the summary and work area agree. */
export function claimState(
	c: { status: string; verdict: string | null; riskSeverity: string | null },
	info?: ClaimStateInfo | null
): ClaimState {
	if (c.status !== 'analyzed') return 'unrun';
	if (c.verdict === 'unsupported' || c.verdict === 'flag' || c.riskSeverity === 'high')
		return 'attention';
	if (info?.undermined)
		return info.inheritedVerdict === 'unsupported' || info.inheritedVerdict === 'flag'
			? 'attention'
			: 'caution';
	if (c.verdict === 'weak' || c.riskSeverity === 'med') return 'caution';
	return 'clear';
}

/** Count claims by review state — the supervisor's at-a-glance triage roll-up.
 *  Pass `infoById` (keyed by claim id) to make the rollup reasoning-graph aware. */
export function claimRollup(
	claims: Array<{ id?: string; status: string; verdict: string | null; riskSeverity: string | null }>,
	infoById?: Record<string, ClaimStateInfo> | null
) {
	const r = { total: claims.length, attention: 0, caution: 0, unrun: 0, clear: 0 };
	for (const c of claims) r[claimState(c, c.id ? infoById?.[c.id] : undefined)]++;
	return r;
}

export const EFFORT: Record<string, { label: string }> = {
	low: { label: 'Low' },
	med: { label: 'Medium' },
	high: { label: 'High' }
};

export const ROLE: Record<string, { label: string; icon: string; tone: Tone; can: string }> = {
	supervisor: {
		label: 'Supervising lawyer',
		icon: 'shield-check',
		tone: 'accent',
		can: 'Uploads documents, reviews, challenges and signs off AI work.'
	}
};

// Single role: the supervising lawyer does everything — uploads work products
// into the queue *and* records the supervisory decisions.
export const CAN_SUBMIT = new Set(['supervisor']);
export const CAN_SUPERVISE = new Set(['supervisor']);

const DT = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});
const D = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function fmtDateTime(iso: string): string {
	const d = new Date(iso);
	return isNaN(d.getTime()) ? iso : DT.format(d);
}
export function fmtDate(iso: string): string {
	const d = new Date(iso);
	return isNaN(d.getTime()) ? iso : D.format(d);
}

/** Worst severity present across a list of risk signals (for the queue row badge). */
export function topSeverity(signals: { severity: string }[]): 'high' | 'med' | 'low' | null {
	if (signals.some((s) => s.severity === 'high')) return 'high';
	if (signals.some((s) => s.severity === 'med')) return 'med';
	if (signals.some((s) => s.severity === 'low')) return 'low';
	return null;
}
