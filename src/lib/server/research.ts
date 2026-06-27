// External research tools for the live research figures — server only.
//
// Two capabilities, both fail-soft (return null on a missing key / network error
// so the caller can fall back to the seeded baseline, keeping the demo offline):
//   - searchPerplexity  → open-web research via Perplexity, scoped to allow/deny
//                          domains the supervisor configured on the web figure.
//   - cellarSearch       → keyword search over EU legislation in CELLAR (SPARQL),
//                          the live mirror of agents/itaily_agents/tools.py.
// Results are KV-cached so repeat runs stay off the network hot path.

import type { KVNamespace } from '@cloudflare/workers-types';
import type { TraceSource } from '$lib/types';
import type { WebToolConfig } from '$lib/workgroups';

const TIMEOUT_MS = 20_000;
const UA = 'ItailyOversight/0.1 (Hack the Law supervision console)';

// --- Perplexity open-web research -------------------------------------------------

const PPLX_URL = 'https://api.perplexity.ai/chat/completions';
const PPLX_KV_PREFIX = 'pplx:';
const PPLX_TTL = 60 * 60 * 6; // 6h
const PPLX_DEFAULT_MODEL = 'sonar';
/** Perplexity caps the domain filter; keep allow+deny within the documented bound. */
const MAX_DOMAINS = 10;

export interface WebResearch {
	answer: string;
	sources: TraceSource[];
}

/** Compose Perplexity's `search_domain_filter`: allow as-is, deny prefixed with `-`. */
function domainFilter(web: WebToolConfig | undefined): string[] {
	if (!web) return [];
	const allow = web.allow ?? [];
	const deny = (web.deny ?? []).map((d) => (d.startsWith('-') ? d : `-${d}`));
	return [...allow, ...deny].slice(0, MAX_DOMAINS);
}

function hostTitle(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

/**
 * Run a scoped open-web search via Perplexity. Returns a short grounded answer plus
 * its sources, or null when the key is absent / the call fails (caller falls back).
 */
export async function searchPerplexity(
	query: string,
	web: WebToolConfig | undefined,
	env: App.Platform['env'],
	kv?: KVNamespace
): Promise<WebResearch | null> {
	const key = env.PERPLEXITY_API_KEY;
	if (!key) return null;

	const model = env.PERPLEXITY_MODEL || PPLX_DEFAULT_MODEL;
	const filter = domainFilter(web);
	const cacheKey = PPLX_KV_PREFIX + model + '|' + filter.join(',') + '|' + query;
	if (kv) {
		const cached = (await kv.get(cacheKey, 'json')) as WebResearch | null;
		if (cached) return cached;
	}

	try {
		const body: Record<string, unknown> = {
			model,
			messages: [
				{
					role: 'system',
					content:
						'You are an EU-law research assistant. Answer the legal question concisely in 2-3 ' +
						'sentences, citing only what the retrieved sources support. Do not invent authorities.'
				},
				{ role: 'user', content: query }
			],
			temperature: 0.1,
			max_tokens: 400
		};
		if (filter.length) body.search_domain_filter = filter;

		const res = await fetch(PPLX_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${key}`,
				'content-type': 'application/json',
				'User-Agent': UA
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) return null;

		const data = (await res.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
			citations?: string[];
			search_results?: Array<{ title?: string; url?: string }>;
		};
		const answer = (data.choices?.[0]?.message?.content ?? '').trim();

		let sources: TraceSource[] = (data.search_results ?? [])
			.filter((s) => s.url)
			.map((s) => ({ title: s.title || hostTitle(s.url as string), url: s.url }));
		if (!sources.length && data.citations?.length) {
			sources = data.citations.map((u) => ({ title: hostTitle(u), url: u }));
		}
		sources = sources.slice(0, 6);

		if (!answer && !sources.length) return null;
		const result: WebResearch = { answer, sources };
		if (kv) await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: PPLX_TTL });
		return result;
	} catch {
		return null;
	}
}

// --- CELLAR keyword search (SPARQL) -----------------------------------------------

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql';
const EURLEX_TXT_BASE = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:';
const LANG_ENG = '<http://publications.europa.eu/resource/authority/language/ENG>';
const CDM_PREFIX = 'PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>';
const CELLAR_SEARCH_KV_PREFIX = 'cellar:search:';
const CELLAR_SEARCH_TTL = 60 * 60 * 24; // 24h

export interface CellarHit {
	celex: string;
	title: string;
	url: string;
}

/** Escape a string for safe inlining into a SPARQL string literal. */
function sparqlEscape(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Keyword search over EU legislation in CELLAR. Public endpoint (no key). Returns the
 * matching acts, or null on network/parse failure. Mirrors the offline ADK tool.
 */
export async function cellarSearch(
	query: string,
	kv?: KVNamespace,
	limit = 5
): Promise<CellarHit[] | null> {
	const q = query.trim();
	if (!q) return null;
	const cap = Math.max(1, Math.min(limit, 10));
	const cacheKey = `${CELLAR_SEARCH_KV_PREFIX}${cap}:${q}`;
	if (kv) {
		const cached = (await kv.get(cacheKey, 'json')) as CellarHit[] | null;
		if (cached) return cached;
	}

	const sparql = `${CDM_PREFIX}
SELECT DISTINCT ?work ?celex ?title WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_has_expression ?exp .
  ?exp cdm:expression_uses_language ${LANG_ENG} .
  ?exp cdm:expression_title ?title .
  FILTER(CONTAINS(LCASE(STR(?title)), LCASE("${sparqlEscape(q)}")))
}
LIMIT ${cap}`;

	try {
		const res = await fetch(SPARQL_ENDPOINT, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				Accept: 'application/sparql-results+json',
				'User-Agent': UA
			},
			body: new URLSearchParams({ query: sparql, format: 'application/sparql-results+json' }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) return null;
		const payload = (await res.json()) as {
			results?: { bindings?: Array<Record<string, { value?: string }>> };
		};
		const hits: CellarHit[] = (payload.results?.bindings ?? []).map((row) => {
			const celex = row.celex?.value ?? '';
			return {
				celex,
				title: row.title?.value ?? '',
				url: celex ? EURLEX_TXT_BASE + celex : ''
			};
		});
		if (kv) await kv.put(cacheKey, JSON.stringify(hits), { expirationTtl: CELLAR_SEARCH_TTL });
		return hits;
	} catch {
		return null;
	}
}
