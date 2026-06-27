"""Itaily offline ADK seed-generation package.

This package is an OFFLINE generator. It is run locally by a developer who holds
API keys to produce ``agents/out/work-products.json``. That JSON is copied into
the SvelteKit app's ``data/seed/work-products.json`` and loaded by
``scripts/load-seed.mjs``. ADK is *never* run inside the deployed Cloudflare
app — its only job here is to produce an authentic "what the AI did" trace
(captured from the ADK Runner event stream) for the supervision console.
"""

__all__ = ["__version__"]

__version__ = "0.1.0"
