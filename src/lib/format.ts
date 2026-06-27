// Shared presentation maps: enum value → human label, Lucide icon name, Badge tone.
// Keeping these in one place stops the queue/detail views from drifting apart.

export type Tone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const WP_TYPE = {
	draft: { label: 'Draft', icon: 'file-text' },
	memo: { label: 'Memo', icon: 'file-text' },
	risk_analysis: { label: 'Risk analysis', icon: 'shield-alert' }
} as const;

export const STATUS: Record<string, { label: string; tone: Tone; icon: string }> = {
	pending: { label: 'Pending review', tone: 'warning', icon: 'clock' },
	approved: { label: 'Approved', tone: 'success', icon: 'circle-check' },
	amended: { label: 'Amended', tone: 'info', icon: 'pencil' },
	rejected: { label: 'Rejected', tone: 'danger', icon: 'circle-x' },
	rework: { label: 'Rework requested', tone: 'warning', icon: 'rotate-ccw' },
	escalated: { label: 'Escalated', tone: 'accent', icon: 'circle-arrow-up' }
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
