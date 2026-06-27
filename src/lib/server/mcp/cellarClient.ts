// A minimal Model Context Protocol client over the Streamable-HTTP transport.
//
// Dependency-free (the project keeps its runtime deps tiny and must stay workerd-safe):
// MCP is JSON-RPC 2.0, and our CELLAR server (src/routes/api/mcp/cellar/+server.ts)
// answers each request with a single JSON response, so a plain fetch loop is a
// faithful client. The EU Law Researcher uses this to drive CELLAR as a real MCP
// client at runtime — `connect → initialize → tools/list → tools/call → close`.

const PROTOCOL_VERSION = '2025-06-18';
const TIMEOUT_MS = 12_000;
const CLIENT_INFO = { name: 'itaily-oversight', version: '0.1.0' };

export interface McpToolDef {
	name: string;
	description?: string;
	inputSchema?: unknown;
}

export interface CellarMcpClient {
	/** Tool definitions advertised by the server (ready to map to LLM tool defs). */
	tools: McpToolDef[];
	/** Invoke a tool; returns the parsed JSON payload of its text content block. */
	callTool(name: string, args: Record<string, unknown>): Promise<{ payload: unknown; isError: boolean }>;
	close(): Promise<void>;
}

/** Connect to a CELLAR MCP server and complete the initialize handshake. */
export async function connectCellarMcp(url: string): Promise<CellarMcpClient> {
	let nextId = 1;
	let sessionId: string | null = null;

	async function rpc(
		method: string,
		params?: Record<string, unknown>,
		isNotification = false
	): Promise<unknown> {
		const body: Record<string, unknown> = { jsonrpc: '2.0', method };
		if (params) body.params = params;
		if (!isNotification) body.id = nextId++;

		const headers: Record<string, string> = {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream'
		};
		if (sessionId) headers['mcp-session-id'] = sessionId;

		const res = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		// A server MAY issue a session id on initialize; echo it back on later calls.
		const sid = res.headers.get('mcp-session-id');
		if (sid) sessionId = sid;

		if (isNotification) return null; // 202 Accepted, no body
		if (!res.ok) throw new Error(`MCP ${method} HTTP ${res.status}`);
		const data = (await res.json()) as { result?: unknown; error?: { message?: string } };
		if (data.error) throw new Error(`MCP ${method}: ${data.error.message ?? 'error'}`);
		return data.result;
	}

	await rpc('initialize', {
		protocolVersion: PROTOCOL_VERSION,
		capabilities: {},
		clientInfo: CLIENT_INFO
	});
	await rpc('notifications/initialized', undefined, true);

	const listed = (await rpc('tools/list', {})) as { tools?: McpToolDef[] } | undefined;
	const tools = listed?.tools ?? [];

	return {
		tools,
		async callTool(name, args) {
			const result = (await rpc('tools/call', { name, arguments: args })) as
				| { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
				| undefined;
			const block = result?.content?.find((c) => c.type === 'text');
			let payload: unknown = block?.text;
			if (typeof block?.text === 'string') {
				try {
					payload = JSON.parse(block.text);
				} catch {
					/* leave as raw text */
				}
			}
			return { payload, isError: Boolean(result?.isError) };
		},
		async close() {
			/* Stateless server — no session to tear down. */
		}
	};
}
