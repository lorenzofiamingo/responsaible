// Runtime CELLAR tool surface, exposed over the Model Context Protocol.
//
// This is the RUNTIME twin of agents/itaily_agents/mcp_cellar_server.py: the same
// three tools (search / fetch / celex), but reachable over MCP's Streamable-HTTP
// transport so the EU Law Researcher figure can drive CELLAR as a real MCP CLIENT
// at runtime (see src/lib/server/mcp/cellarClient.ts), instead of calling the
// in-process helpers directly. The tools wrap the existing, KV-cached CELLAR
// integration (cellarSearch / resolveCelex) — only public EU legal data, no secrets,
// so this endpoint is intentionally unauthenticated.
//
// We implement a compact, dependency-free subset of the MCP spec: JSON-RPC 2.0 over
// a single POST endpoint, returning one JSON response per request (the spec permits a
// plain `application/json` reply when the server emits no server-initiated messages).

import { resolveCelex } from '$lib/server/cellar';
import { cellarSearch } from '$lib/server/research';
import { buildCelex, eurlexUrl, type ActKind } from '$lib/server/extract/celex';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'itaily-cellar', version: '0.1.0' };

// JSON-Schema for each tool's arguments — surfaced verbatim through tools/list so an
// MCP client (and the LLM behind it) knows how to call them.
const TOOLS = [
	{
		name: 'search',
		description:
			'Search EU legislation in CELLAR by keyword (title match); returns matching CELEX ids + titles.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'Keyword(s) to match against act titles.' },
				limit: { type: 'integer', description: 'Max results (1–10).', default: 5 }
			},
			required: ['query']
		}
	},
	{
		name: 'fetch',
		description:
			'Confirm an EU act resolves by its CELEX id against the EU Publications Office; returns whether it exists + source metadata.',
		inputSchema: {
			type: 'object',
			properties: {
				celex: { type: 'string', description: 'CELEX id, e.g. 32016R0679.' }
			},
			required: ['celex']
		}
	},
	{
		name: 'celex',
		description:
			"Build a CELEX id from a human 'year/number' citation and act type (no network). Use before `fetch` to verify.",
		inputSchema: {
			type: 'object',
			properties: {
				citation: { type: 'string', description: "e.g. '2016/679' or 'Regulation (EU) 2016/679'." },
				act_type: {
					type: 'string',
					enum: ['regulation', 'directive', 'decision'],
					description: 'Instrument kind (default regulation).',
					default: 'regulation'
				}
			},
			required: ['citation']
		}
	}
] as const;

// JSON-RPC error codes (subset).
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

type JsonRpcId = string | number | null;

function rpcResult(id: JsonRpcId, result: unknown) {
	return json({ jsonrpc: '2.0', id, result });
}
function rpcError(id: JsonRpcId, code: number, message: string, status = 200) {
	return json({ jsonrpc: '2.0', id, error: { code, message } }, { status });
}

/** Wrap a tool's structured result as an MCP tool-result content block. */
function toolResult(payload: unknown, isError = false) {
	return { content: [{ type: 'text', text: JSON.stringify(payload) }], isError };
}

const ACT_KIND: Record<string, ActKind> = { regulation: 'reg', directive: 'dir', decision: 'dec' };

/** Derive a CELEX from a "year/number" citation + act type — the runtime twin of celex_from_cite. */
function celexFromCite(citation: string, actType: string): Record<string, unknown> {
	const c = String(citation ?? '');
	// Pick kind from an explicit word in the citation, else the act_type argument.
	let kind: ActKind = ACT_KIND[String(actType ?? '').toLowerCase()] ?? 'reg';
	if (/\bdirective\b/i.test(c)) kind = 'dir';
	else if (/\bdecision\b/i.test(c)) kind = 'dec';
	else if (/\bregulation\b/i.test(c)) kind = 'reg';

	const m = c.match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
	if (!m) return { ok: false, error: 'No "year/number" pattern found in citation.' };
	let year = Number(m[1]);
	let num = Number(m[2]);
	// The 4-digit token is the year (handles both YYYY/NNN and NNN/YYYY orderings).
	if (String(m[1]).length !== 4 && String(m[2]).length === 4) {
		year = Number(m[2]);
		num = Number(m[1]);
	}
	if (!(year >= 1951 && year <= 2030) || num < 1) {
		return { ok: false, error: 'Implausible year/number for an EU act.' };
	}
	const derived = buildCelex(kind, year, num);
	return { ok: true, celex: derived.celex, eli: derived.eli, source_url: derived.sourceUrl };
}

async function callTool(
	name: string,
	args: Record<string, unknown>,
	env: App.Platform['env'] | undefined
) {
	const kv = env?.KV;
	if (name === 'search') {
		const query = String(args.query ?? '').trim();
		if (!query) return toolResult({ ok: false, error: 'query is required' }, true);
		const limit = typeof args.limit === 'number' ? args.limit : 5;
		const hits = await cellarSearch(query, kv, limit);
		if (hits == null) return toolResult({ ok: false, error: 'CELLAR search unavailable.' }, true);
		return toolResult({ ok: true, results: hits });
	}
	if (name === 'fetch') {
		const celex = String(args.celex ?? '').trim().toUpperCase();
		if (!celex) return toolResult({ ok: false, error: 'celex is required' }, true);
		const r = await resolveCelex(celex, kv);
		return toolResult({
			ok: true,
			resolves: r.status === 'verified',
			status: r.httpStatus,
			celex: r.celex,
			source_url: eurlexUrl(celex)
		});
	}
	if (name === 'celex') {
		return toolResult(celexFromCite(String(args.citation ?? ''), String(args.act_type ?? 'regulation')));
	}
	return null; // unknown tool
}

export const POST: RequestHandler = async ({ request, platform }) => {
	let msg: { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> };
	try {
		msg = await request.json();
	} catch {
		return rpcError(null, PARSE_ERROR, 'Invalid JSON.', 400);
	}

	const id: JsonRpcId = msg?.id ?? null;
	const method = msg?.method;
	if (typeof method !== 'string') return rpcError(id, INVALID_REQUEST, 'Missing method.', 400);

	// Notifications (no id) — acknowledge with 202 and no body, per the transport spec.
	if (msg.id === undefined) return new Response(null, { status: 202 });

	switch (method) {
		case 'initialize': {
			const requested = (msg.params?.protocolVersion as string) || PROTOCOL_VERSION;
			return rpcResult(id, {
				protocolVersion: requested,
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO
			});
		}
		case 'ping':
			return rpcResult(id, {});
		case 'tools/list':
			return rpcResult(id, { tools: TOOLS });
		case 'tools/call': {
			const name = String(msg.params?.name ?? '');
			const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
			const result = await callTool(name, args, platform?.env);
			if (result == null) return rpcError(id, INVALID_PARAMS, `Unknown tool: ${name}`);
			return rpcResult(id, result);
		}
		default:
			return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
	}
};
