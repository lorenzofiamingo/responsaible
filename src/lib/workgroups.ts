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
	| 'claude-opus-4-8'
	| 'nemotron';

export type PresetId =
	| 'quick_scan'
	| 'standard_review'
	| 'authority_deep_dive'
	| 'web_augmented_audit'
	| 'full_research_panel';

/**
 * A research figure carries one or more TOOLS — the actual capability it uses to
 * "research". Each maps onto a real retrieval surface:
 *   cellar    → EU CELLAR / EUR-Lex (authority lookup & grounding).
 *   web       → open-web research via Perplexity, scoped to allow/deny domains.
 *   knowledge → the firm's own private knowledge base (kept on-perimeter).
 * Drafter / critic figures take no tools.
 */
export type ResearchTool = 'cellar' | 'web' | 'knowledge';

/** Per-figure config for the web tool — the domains Perplexity may / may not use. */
export interface WebToolConfig {
	/** Domains the search is restricted to (empty ⇒ open web). */
	allow: string[];
	/** Domains explicitly excluded (sent to Perplexity as `-domain`). */
	deny: string[];
}

export interface Figure {
	role: FigureRole;
	model: ModelId;
	effort: Effort;
	/** One-line description of what this figure does for the claim. */
	desc: string;
	/** Tools a research figure is equipped with. Omitted/empty ⇒ grounding only. */
	tools?: ResearchTool[];
	/** Domain filters for the web tool (only meaningful when tools includes 'web'). */
	web?: WebToolConfig;
}

export interface WorkGroup {
	/** A preset id, or 'custom' once the supervisor edits a figure. */
	id: PresetId | 'custom';
	label: string;
	figures: Figure[];
}

export const MODELS: Record<
	ModelId,
	{
		label: string;
		provider: 'google' | 'anthropic' | 'nvidia';
		tier: 'small' | 'medium' | 'large';
		/** Open weights, self-hostable — keeps confidential input on-perimeter. */
		open?: boolean;
	}
> = {
	'gemini-2.5-flash': { label: 'Gemini 2.5 Flash', provider: 'google', tier: 'small' },
	'gemini-2.5-pro': { label: 'Gemini 2.5 Pro', provider: 'google', tier: 'large' },
	'claude-haiku': { label: 'Claude Haiku', provider: 'anthropic', tier: 'small' },
	'claude-sonnet': { label: 'Claude Sonnet', provider: 'anthropic', tier: 'medium' },
	'claude-opus-4-8': { label: 'Claude Opus 4.8', provider: 'anthropic', tier: 'large' },
	// Open-weights model served via NVIDIA NIM (OpenAI-compatible). Self-hostable,
	// so the privacy-sensitive firm-knowledge figure can keep its input private.
	nemotron: { label: 'NVIDIA Nemotron', provider: 'nvidia', tier: 'large', open: true }
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

/** Display metadata for each research tool — drives the figure palette + trace badges. */
export const RESEARCH_TOOL: Record<ResearchTool, { label: string; icon: string; blurb: string }> = {
	cellar: {
		label: 'CELLAR',
		icon: 'gavel',
		blurb: 'Searches & verifies EU authorities in the official CELLAR / EUR-Lex corpus.'
	},
	web: {
		label: 'Web',
		icon: 'external-link',
		blurb: 'Open-web research via Perplexity, scoped to trusted domains you choose.'
	},
	knowledge: {
		label: 'Firm knowledge',
		icon: 'lock',
		blurb: "Draws on the firm's private knowledge base — stays on-perimeter (open model)."
	}
};

export const RESEARCH_TOOL_IDS = Object.keys(RESEARCH_TOOL) as ResearchTool[];

/** A sensible default allow-list for the web tool in an EU-law console. */
export const DEFAULT_WEB_ALLOW = [
	'eur-lex.europa.eu',
	'curia.europa.eu',
	'edpb.europa.eu',
	'eba.europa.eu'
];

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

/**
 * The palette of ready-made figures the supervisor can drop into a work group —
 * three researchers pre-tuned to excel in their field (each wired to one tool),
 * plus the generic drafter / critic. These sit alongside the blank custom figure.
 */
export type FigurePresetId =
	| 'cellar_researcher'
	| 'web_researcher'
	| 'knowledge_researcher'
	| 'drafter'
	| 'critic';

export const FIGURE_PRESETS: Record<FigurePresetId, { label: string; icon: string; make: () => Figure }> = {
	cellar_researcher: {
		label: 'EU Law researcher',
		icon: RESEARCH_TOOL.cellar.icon,
		make: () => ({
			role: 'research',
			// Claude Sonnet 4.6 drives the CELLAR/EUR-Lex tools over MCP: best tool-use
			// discipline and the lowest rate of inventing a CELEX that doesn't resolve.
			model: 'claude-sonnet',
			effort: 'high',
			desc: 'Drives CELLAR / EUR-Lex over MCP to verify every authority the claim cites — never invents one.',
			tools: ['cellar']
		})
	},
	web_researcher: {
		label: 'Web researcher',
		icon: RESEARCH_TOOL.web.icon,
		make: () => ({
			role: 'research',
			model: 'claude-sonnet',
			effort: 'med',
			desc: 'Targeted open-web research via Perplexity, scoped to trusted EU domains.',
			tools: ['web'],
			web: { allow: [...DEFAULT_WEB_ALLOW], deny: [] }
		})
	},
	knowledge_researcher: {
		label: 'Firm knowledge researcher',
		icon: RESEARCH_TOOL.knowledge.icon,
		make: () => ({
			role: 'research',
			model: 'nemotron',
			effort: 'med',
			desc: "Consults the firm's private knowledge base on a self-hostable open model (stays on-perimeter).",
			tools: ['knowledge']
		})
	},
	drafter: {
		label: 'Drafter',
		icon: FIGURE_ROLE.drafter.icon,
		make: () => ({
			role: 'drafter',
			model: 'claude-opus-4-8',
			effort: 'high',
			desc: 'Re-states the claim and pins each [n] to an article locator.'
		})
	},
	critic: {
		label: 'Critic',
		icon: FIGURE_ROLE.critic.icon,
		make: () => ({
			role: 'critic',
			model: 'claude-sonnet',
			effort: 'med',
			desc: 'Re-verifies the citation resolves and rates support + risk.'
		})
	}
};

export const FIGURE_PRESET_IDS = Object.keys(FIGURE_PRESETS) as FigurePresetId[];

/** The tools a figure actually carries (only research figures do). */
export function figureTools(fig: Figure): ResearchTool[] {
	return fig.role === 'research' ? (fig.tools ?? []) : [];
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
				desc: 'Confirms the governing EU instrument for the claim.',
				tools: ['cellar']
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
				model: 'claude-sonnet',
				effort: 'high',
				desc: 'Drives CELLAR / EUR-Lex over MCP to verify every authority the claim relies on.',
				tools: ['cellar']
			},
			{
				role: 'critic',
				model: 'claude-opus-4-8',
				effort: 'high',
				desc: 'Adversarially re-checks every CELEX resolves and stress-tests jurisdiction/deadline.'
			}
		]
	},
	web_augmented_audit: {
		id: 'web_augmented_audit',
		label: 'Web-augmented audit',
		figures: [
			{
				role: 'research',
				model: 'claude-sonnet',
				effort: 'high',
				desc: 'Drives CELLAR / EUR-Lex over MCP to verify every authority the claim relies on.',
				tools: ['cellar']
			},
			{
				role: 'research',
				model: 'claude-sonnet',
				effort: 'med',
				desc: 'Corroborates with targeted open-web research on trusted domains.',
				tools: ['web'],
				web: { allow: [...DEFAULT_WEB_ALLOW], deny: [] }
			},
			{
				role: 'critic',
				model: 'claude-opus-4-8',
				effort: 'high',
				desc: 'Adversarially re-checks every CELEX resolves and stress-tests jurisdiction/deadline.'
			}
		]
	},
	// The flagship manual preset: all three canonical researchers run in parallel, then
	// an Opus critic weighs every finding. Manual-only — never returned by autoPreset,
	// so it stays outside the atomic_claim.assigned_preset DB enum (no migration).
	full_research_panel: {
		id: 'full_research_panel',
		label: 'Full research panel',
		figures: [
			{
				role: 'research',
				model: 'claude-sonnet',
				effort: 'high',
				desc: 'EU Law researcher — drives CELLAR / EUR-Lex over MCP to verify every cited authority.',
				tools: ['cellar']
			},
			{
				role: 'research',
				model: 'claude-sonnet',
				effort: 'med',
				desc: 'Web researcher — targeted open-web corroboration via Perplexity on trusted domains.',
				tools: ['web'],
				web: { allow: [...DEFAULT_WEB_ALLOW], deny: [] }
			},
			{
				role: 'research',
				model: 'nemotron',
				effort: 'med',
				desc: "Firm knowledge researcher — consults the firm's private corpus on a self-hostable open model.",
				tools: ['knowledge']
			},
			{
				role: 'critic',
				model: 'claude-opus-4-8',
				effort: 'high',
				desc: 'Weighs all three researchers, re-checks every CELEX, and delivers the verdict + risk.'
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
		authority_deep_dive: { tone: 'accent', hint: 'Citation-bearing or high-risk claims' },
		web_augmented_audit: { tone: 'accent', hint: 'High-stakes claims needing open-web corroboration' },
		full_research_panel: { tone: 'accent', hint: 'EU Law + Web + Firm-knowledge researchers, then an Opus critic' }
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
