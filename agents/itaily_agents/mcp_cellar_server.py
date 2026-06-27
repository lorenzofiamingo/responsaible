"""A small MCP server exposing the EU CELLAR tools over the Model Context Protocol.

This wraps the existing functions in ``tools.py`` (``cellar_search`` / ``cellar_fetch``
/ ``celex_from_cite``) as MCP tools so the CELLAR researcher agent can consume them via
ADK's ``MCPToolset`` instead of as in-process FunctionTools. Same capability, but the
CELLAR integration is now a standalone, reusable server — the state-of-the-art way to
share a tool surface across agents/clients.

Run standalone (stdio transport):

    python -m itaily_agents.mcp_cellar_server

The pipeline launches it automatically when ``ITAILY_CELLAR_MCP=1`` (see pipeline.py).

VERIFY against your installed `mcp` package: ``from mcp.server.fastmcp import FastMCP``
is the documented FastMCP entry point (mcp>=1.0).
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from .tools import cellar_fetch, cellar_search, celex_from_cite

mcp = FastMCP("itaily-cellar")


@mcp.tool()
def search(query: str, limit: int = 5) -> dict[str, Any]:
    """Search EU legislation in CELLAR by keyword; returns CELEX ids + titles."""
    return cellar_search(query, limit)


@mcp.tool()
def fetch(celex: str, fmt: str = "identifiers") -> dict[str, Any]:
    """Confirm an EU act resolves by its CELEX id and return source metadata."""
    return cellar_fetch(celex, fmt)


@mcp.tool()
def celex(citation: str, act_type: str = "regulation") -> dict[str, Any]:
    """Build a CELEX id from a human 'year/number' citation (no network)."""
    return celex_from_cite(citation, act_type)


if __name__ == "__main__":
    # Default stdio transport — what ADK's MCPToolset(StdioServerParameters(...)) spawns.
    mcp.run()
