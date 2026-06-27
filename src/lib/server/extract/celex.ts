/**
 * CELEX / EU-authority helpers for document intake — the TypeScript mirror of the
 * offline ADK pipeline's `celex_from_cite` (see agents/itaily_agents/tools.py).
 *
 * Pure, no network. Detection is deliberately conservative: we only emit a CELEX
 * when we can derive a structurally valid one, so the heuristic extractor never
 * fabricates an authority. Live resolution against CELLAR happens later, on the
 * /new review screen, via /api/cellar/verify.
 */

const EURLEX_TXT_BASE = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:';
const ELI_BASE = 'http://data.europa.eu/eli';

export type ActKind = 'reg' | 'dir' | 'dec';

const LETTER: Record<ActKind, string> = { reg: 'R', dir: 'L', dec: 'D' };
const ELI_SEGMENT: Record<ActKind, string> = { reg: 'reg', dir: 'dir', dec: 'dec' };

export interface DerivedAuthority {
	celex: string;
	eli: string | null;
	sourceUrl: string;
	kind: ActKind;
	year: number;
	number: number;
}

/** Public EUR-Lex page for a CELEX — the link a human opens from the console. */
export function eurlexUrl(celex: string): string {
	return EURLEX_TXT_BASE + celex;
}

/**
 * Build a CELEX from an act kind + year/number, e.g. ("reg", 2016, 679) →
 * 32016R0679. CELEX for secondary legislation = sector 3 + year + type letter +
 * 4-digit zero-padded running number.
 */
export function buildCelex(kind: ActKind, year: number, num: number): DerivedAuthority {
	const celex = `3${year}${LETTER[kind]}${String(num).padStart(4, '0')}`;
	return {
		celex,
		eli: `${ELI_BASE}/${ELI_SEGMENT[kind]}/${year}/${num}/oj`,
		sourceUrl: eurlexUrl(celex),
		kind,
		year,
		number: num
	};
}

/** A year is plausible for an EU act from the founding treaties to "now-ish". */
function plausibleYear(y: number): boolean {
	return y >= 1951 && y <= 2030;
}

const KIND_WORD: Record<string, ActKind> = {
	regulation: 'reg',
	directive: 'dir',
	decision: 'dec'
};

/**
 * Well-known EU acts, keyed by aliases people actually write (GDPR, AI Act, …).
 * Lets the extractor recognise a named instrument even when the document never
 * spells out its number — which is what makes the intake feel like it *knows* EU law.
 */
interface KnownAct {
	celex: string;
	title: string;
	kind: ActKind;
	aliases: RegExp;
}

const KNOWN_ACTS: KnownAct[] = [
	{
		celex: '32016R0679',
		title: 'Regulation (EU) 2016/679 (GDPR)',
		kind: 'reg',
		aliases: /\b(gdpr|general data protection regulation)\b/i
	},
	{
		celex: '32024R1689',
		title: 'Regulation (EU) 2024/1689 (AI Act)',
		kind: 'reg',
		aliases: /\b(ai act|artificial intelligence act)\b/i
	},
	{
		celex: '32022R2065',
		title: 'Regulation (EU) 2022/2065 (Digital Services Act)',
		kind: 'reg',
		aliases: /\b(digital services act|\bdsa\b)\b/i
	},
	{
		celex: '32022R1925',
		title: 'Regulation (EU) 2022/1925 (Digital Markets Act)',
		kind: 'reg',
		aliases: /\b(digital markets act|\bdma\b)\b/i
	},
	{
		celex: '32002L0058',
		title: 'Directive 2002/58/EC (ePrivacy Directive)',
		kind: 'dir',
		aliases: /\b(eprivacy|e-privacy)\b/i
	},
	{
		celex: '32011L0083',
		title: 'Directive 2011/83/EU (Consumer Rights Directive)',
		kind: 'dir',
		aliases: /\bconsumer rights directive\b/i
	},
	{
		celex: '32023D1795',
		title: 'Decision (EU) 2023/1795 (EU–US Data Privacy Framework adequacy)',
		kind: 'dec',
		aliases: /\b(data privacy framework|\bdpf\b|eu[\s–-]+us data)\b/i
	},
	{
		celex: '32022L2555',
		title: 'Directive (EU) 2022/2555 (NIS2)',
		kind: 'dir',
		aliases: /\b(nis ?2|nis2 directive)\b/i
	},
	{
		celex: '32023R2854',
		title: 'Regulation (EU) 2023/2854 (Data Act)',
		kind: 'reg',
		aliases: /\bdata act\b/i
	},
	{
		celex: '32022R0868',
		title: 'Regulation (EU) 2022/868 (Data Governance Act)',
		kind: 'reg',
		aliases: /\bdata governance act\b/i
	},
	{
		celex: '32012R1215',
		title: 'Regulation (EU) 1215/2012 (Brussels I Recast)',
		kind: 'reg',
		aliases: /\bbrussels i(?: ?recast| ?bis)?\b/i
	},
	{
		celex: '32008R0593',
		title: 'Regulation (EC) 593/2008 (Rome I)',
		kind: 'reg',
		aliases: /\brome i\b/i
	},
	{
		celex: '32019L0790',
		title: 'Directive (EU) 2019/790 (Copyright in the DSM)',
		kind: 'dir',
		aliases: /\b(copyright directive|dsm directive)\b/i
	},
	{
		celex: '32019L1937',
		title: 'Directive (EU) 2019/1937 (Whistleblowing)',
		kind: 'dir',
		aliases: /\bwhistleblow\w*\b/i
	}
];

export interface DetectedCitation {
	celex: string;
	title: string;
	eli: string | null;
	sourceUrl: string;
	/** The exact text in the document that triggered the match. */
	matchText: string;
	/** Character offset of the first occurrence in the source text. */
	index: number;
	/** "Art. 30(1)" style locator detected near the match, if any. */
	locator: string;
	/** Sentence the citation appeared in — used as the citation snippet. */
	snippet: string;
}

// "Regulation (EU) 2016/679", "Directive 2011/83/EU", "Regulation (EU) No 1215/2012".
const CITE_RE =
	/\b(Regulation|Directive|Decision)\s*(?:\(\s*(?:EU|EC|EEC|Euratom)\s*\)\s*)?(?:No\.?\s*)?(\d{1,4})\s*\/\s*(\d{1,4})(?:\s*\/\s*(?:EU|EC|EEC|Euratom))?/gi;

// A bare CELEX already written in the document, e.g. 32016R0679.
const RAW_CELEX_RE = /\b3\d{4}[RLD]\d{4}\b/g;

// "Article 30(1)", "Art. 6(1)(f)".
const ARTICLE_RE = /\bArt(?:icle|\.)?\s*(\d+[a-z]?)(\s*\(\s*\d+\s*\)(?:\s*\([a-z]+\))?)?/i;

/** The sentence containing character offset `idx` (best-effort). */
function sentenceAt(text: string, idx: number): string {
	const start = Math.max(
		text.lastIndexOf('. ', idx) + 1,
		text.lastIndexOf('\n', idx) + 1,
		0
	);
	let end = text.indexOf('. ', idx);
	if (end === -1) end = text.indexOf('\n', idx);
	if (end === -1) end = Math.min(text.length, idx + 240);
	return text.slice(start, end + 1).replace(/\s+/g, ' ').trim();
}

/** A locator ("Art. 30(1)") found within ~80 chars around the citation. */
function locatorNear(text: string, idx: number): string {
	const window = text.slice(Math.max(0, idx - 90), Math.min(text.length, idx + 90));
	const m = window.match(ARTICLE_RE);
	if (!m) return '';
	const art = m[1];
	const sub = (m[2] ?? '').replace(/\s+/g, '');
	return `Art. ${art}${sub}`;
}

/**
 * Scan a document for citeable EU authorities. Returns one entry per *distinct*
 * CELEX (first occurrence wins), in order of appearance. Combines three signals:
 * explicit "Regulation (EU) YYYY/NNN" cites, bare CELEX ids, and named acts.
 */
export function detectCitations(text: string): DetectedCitation[] {
	const byCelex = new Map<string, DetectedCitation>();

	const add = (
		celex: string,
		title: string,
		eli: string | null,
		sourceUrl: string,
		matchText: string,
		index: number
	) => {
		if (byCelex.has(celex)) return;
		byCelex.set(celex, {
			celex,
			title,
			eli,
			sourceUrl,
			matchText,
			index,
			locator: locatorNear(text, index),
			snippet: sentenceAt(text, index)
		});
	};

	// 1) Explicit "Regulation (EU) 2016/679" style cites.
	for (const m of text.matchAll(CITE_RE)) {
		const kind = KIND_WORD[m[1].toLowerCase()];
		if (!kind) continue;
		// Two numbers; the 4-digit one is the year (handles both YYYY/NNN and the
		// rarer NNN/YYYY ordering of older instruments).
		const a = Number(m[2]);
		const b = Number(m[3]);
		let year: number, num: number;
		if (String(m[2]).length === 4 && plausibleYear(a)) {
			year = a;
			num = b;
		} else if (String(m[3]).length === 4 && plausibleYear(b)) {
			year = b;
			num = a;
		} else {
			continue;
		}
		if (!plausibleYear(year) || num < 1) continue;
		const d = buildCelex(kind, year, num);
		const label = kind === 'reg' ? 'Regulation' : kind === 'dir' ? 'Directive' : 'Decision';
		// Preserve the union qualifier the source actually used (EU/EC/EEC/Euratom)
		// rather than always asserting "(EU)"; omit it when none is given.
		const union = (m[0].match(/\b(Euratom|EEC|EU|EC)\b/) ?? [])[1];
		const tag = union ? `(${union}) ` : '';
		add(d.celex, `${label} ${tag}${year}/${num}`, d.eli, d.sourceUrl, m[0], m.index ?? 0);
	}

	// 2) Bare CELEX ids already in the text.
	for (const m of text.matchAll(RAW_CELEX_RE)) {
		const celex = m[0];
		const year = Number(celex.slice(1, 5));
		const letter = celex[5] as 'R' | 'L' | 'D';
		const kind: ActKind = letter === 'R' ? 'reg' : letter === 'L' ? 'dir' : 'dec';
		const num = Number(celex.slice(6));
		const label = kind === 'reg' ? 'Regulation' : kind === 'dir' ? 'Directive' : 'Decision';
		add(
			celex,
			`${label} (EU) ${year}/${num}`,
			`${ELI_BASE}/${ELI_SEGMENT[kind]}/${year}/${num}/oj`,
			eurlexUrl(celex),
			celex,
			m.index ?? 0
		);
	}

	// 3) Named, well-known acts (GDPR, AI Act, …).
	for (const act of KNOWN_ACTS) {
		const m = act.aliases.exec(text);
		if (!m) continue;
		const year = Number(act.celex.slice(1, 5));
		const num = Number(act.celex.slice(6));
		add(
			act.celex,
			act.title,
			`${ELI_BASE}/${ELI_SEGMENT[act.kind]}/${year}/${num}/oj`,
			eurlexUrl(act.celex),
			m[0],
			m.index ?? 0
		);
	}

	return [...byCelex.values()].sort((a, b) => a.index - b.index);
}

/** True when a CELEX is structurally implausible (used to flag a hallucination). */
export function suspiciousCelex(celex: string): boolean {
	if (!/^3\d{4}[RLD]\d{4}$/.test(celex)) return true;
	const year = Number(celex.slice(1, 5));
	const num = Number(celex.slice(6));
	return !plausibleYear(year) || num < 1;
}
