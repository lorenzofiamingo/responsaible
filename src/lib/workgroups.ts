// Work-group presets for per-claim ADK analysis.
//
// A "work group" (gruppo di lavoro) is an ordered set of FIGURES. Each figure
// maps onto one of the offline ADK roles (research / drafter / critic) and
// carries the model + effort it runs at. The supervisor picks one of three
// presets — or edits the figures into a custom group — per atomic claim.
//
// This file is the single source of truth, mirrored byte-for-byte in
// agents/itaily_agents/workgroups.py so the auto-assignment heuristic is
// identical offline (seed) and online (live run). Client-safe: no secrets.

export type Effort = 'low' | 'med' | 'high';
export type FigureRole = 'research' | 'drafter' | 'critic';
export type ModelId =
	| 'gemini-2.5-flash'
	| 'gemini-2.5-pro'
	| 'claude-haiku'
	| 'claude-sonnet'
	| 'claude-opus-4-8';

export type PresetId = 'quick_scan' | 'standard_review' | 'authority_deep_dive';

export interface Figure {
	role: FigureRole;
	model: ModelId;
	effort: Effort;
	/** One-line description of what this figure does for the claim. */
	desc: string;
}

export interface WorkGroup {
	/** A preset id, or 'custom' once the supervisor edits a figure. */
	id: PresetId | 'custom';
	label: string;
	figures: Figure[];
}

export const MODELS: Record<
	ModelId,
	{ label: string; provider: 'google' | 'anthropic'; tier: 'small' | 'medium' | 'large' }
> = {
	'gemini-2.5-flash': { label: 'Gemini 2.5 Flash', provider: 'google', tier: 'small' },
	'gemini-2.5-pro': { label: 'Gemini 2.5 Pro', provider: 'google', tier: 'large' },
	'claude-haiku': { label: 'Claude Haiku', provider: 'anthropic', tier: 'small' },
	'claude-sonnet': { label: 'Claude Sonnet', provider: 'anthropic', tier: 'medium' },
	'claude-opus-4-8': { label: 'Claude Opus 4.8', provider: 'anthropic', tier: 'large' }
};

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];
export const EFFORTS: Effort[] = ['low', 'med', 'high'];

export const FIGURE_ROLE: Record<FigureRole, { label: string; icon: string }> = {
	research: { label: 'Researcher', icon: 'search' },
	drafter: { label: 'Drafter', icon: 'pencil' },
	critic: { label: 'Critic', icon: 'shield-alert' }
};

/** Roles a figure can take, in display order — for the custom work-group editor. */
export const FIGURE_ROLE_IDS = Object.keys(FIGURE_ROLE) as FigureRole[];

/** Soft cap on how many figures a custom work group may hold, to keep a run bounded. */
export const MAX_FIGURES = 5;

/** A fresh figure for the custom editor — a light researcher to start from. */
export function newFigure(): Figure {
	return {
		role: 'research',
		model: 'gemini-2.5-flash',
		effort: 'med',
		desc: 'Custom figure added by the supervisor.'
	};
}

export const PRESETS: Record<PresetId, WorkGroup> = {
	quick_scan: {
		id: 'quick_scan',
		label: 'Quick scan',
		figures: [
			{
				role: 'critic',
				model: 'gemini-2.5-flash',
				effort: 'low',
				desc: 'Sanity-checks the claim for any stray legal assertion; no CELLAR lookup.'
			}
		]
	},
	standard_review: {
		id: 'standard_review',
		label: 'Standard review',
		figures: [
			{
				role: 'research',
				model: 'gemini-2.5-flash',
				effort: 'med',
				desc: 'Confirms the governing EU instrument for the claim.'
			},
			{
				role: 'critic',
				model: 'claude-sonnet',
				effort: 'med',
				desc: 'Re-verifies the citation resolves and rates support + risk.'
			}
		]
	},
	authority_deep_dive: {
		id: 'authority_deep_dive',
		label: 'Authority audit',
		figures: [
			{
				role: 'research',
				model: 'gemini-2.5-pro',
				effort: 'high',
				desc: 'Exhaustively searches CELLAR for every authority the claim relies on.'
			},
			{
				role: 'drafter',
				model: 'claude-opus-4-8',
				effort: 'high',
				desc: "Re-states the claim and pins each [n] to an article locator."
			},
			{
				role: 'critic',
				model: 'claude-opus-4-8',
				effort: 'high',
				desc: 'Adversarially re-checks every CELEX resolves and stress-tests jurisdiction/deadline.'
			}
		]
	}
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
export const DEFAULT_PRESET: PresetId = 'standard_review';

export const PRESET_META: Record<PresetId, { tone: 'neutral' | 'info' | 'accent'; hint: string }> =
	{
		quick_scan: { tone: 'neutral', hint: 'Headings, boilerplate, low-risk text' },
		standard_review: { tone: 'info', hint: 'Ordinary claims and definitions' },
		authority_deep_dive: { tone: 'accent', hint: 'Citation-bearing or high-risk claims' }
	};

/** True when the claim text carries a [n] citation marker. */
export function hasCitationMarker(text: string): boolean {
	return /\[\d+\]/.test(text);
}

const MODAL_OBLIGATION = /\b(shall|must|is required to|may not|prohibited|obliged)\b/i;

/**
 * Deterministic auto-assignment of a preset to a claim, based on its nature.
 * MUST stay identical to `auto_preset` in agents/itaily_agents/workgroups.py.
 * First match wins.
 */
export function autoPreset(input: { text: string; kind?: string }): PresetId {
	const text = input.text ?? '';
	const kind = input.kind ?? 'assertion';
	if (kind === 'heading' || kind === 'boilerplate' || text.trim().length < 40) {
		return 'quick_scan';
	}
	if (hasCitationMarker(text) || kind === 'citation_ref' || kind === 'obligation' || MODAL_OBLIGATION.test(text)) {
		return 'authority_deep_dive';
	}
	return 'standard_review';
}

/** Resolve a preset/custom request into a concrete WorkGroup. */
export function resolveWorkGroup(req: { preset?: PresetId; figures?: Figure[] } | undefined, fallback: PresetId): WorkGroup {
	if (req?.figures && req.figures.length) {
		return { id: 'custom', label: 'Custom', figures: req.figures };
	}
	const id = req?.preset ?? fallback;
	return PRESETS[id] ?? PRESETS[fallback];
}
