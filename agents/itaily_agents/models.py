"""Single place that decides which LLM the ADK agents use.

Default: Gemini natively, via ADK's plain *string* model id (ADK resolves a bare
string like ``"gemini-2.5-flash"`` to its built-in Gemini integration).

Switch: set ``ITAILY_MODEL_PROVIDER=claude`` to route every agent through
Anthropic Claude using ADK's LiteLlm wrapper. That is the ONLY line you need to
change models — agents in ``pipeline.py`` call :func:`get_model` and never name a
model directly.

Environment variables (see ``.env.example``):
    ITAILY_MODEL_PROVIDER   "gemini" (default) | "claude"
    ITAILY_GEMINI_MODEL     override the Gemini model id (optional)
    ITAILY_CLAUDE_MODEL     override the Claude model id (optional)
    GOOGLE_API_KEY          required when provider=gemini (or use Vertex vars)
    ANTHROPIC_API_KEY       required when provider=claude
"""

from __future__ import annotations

import os

# Sensible current defaults. Override via env if these ids change.
#  - Gemini: a fast, cheap, capable model is plenty for seed generation.
#  - Claude: Opus 4.8 is the strongest reasoning option for legal drafting.
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_CLAUDE_MODEL = "anthropic/claude-opus-4-8"

# The "model name" string we stamp onto every work product so the console shows
# which model produced it. Kept here so it stays in sync with the real choice.
MODEL_LABEL_GEMINI = "gemini-2.5 (ADK)"
MODEL_LABEL_CLAUDE = "claude-opus-4-8 (ADK)"


def _provider() -> str:
    """Return the normalized provider name ("gemini" | "claude")."""
    return os.getenv("ITAILY_MODEL_PROVIDER", "gemini").strip().lower()


def get_model():
    """Return the model object/string to hand to an ADK ``LlmAgent(model=...)``.

    - provider=gemini -> a bare string id (ADK's native Gemini path).
    - provider=claude -> a ``LiteLlm`` instance wrapping the Anthropic model.

    The return type is intentionally ``LlmAgent``-friendly: ADK accepts either a
    string or a ``BaseLlm`` (such as ``LiteLlm``) for the ``model`` argument.
    """
    provider = _provider()

    if provider == "claude":
        # Imported lazily so a Gemini-only run does not require litellm to be
        # installed/configured.
        #
        # VERIFY against installed ADK: the documented import path is
        # ``from google.adk.models.lite_llm import LiteLlm``.
        from google.adk.models.lite_llm import LiteLlm

        claude_model = os.getenv("ITAILY_CLAUDE_MODEL", DEFAULT_CLAUDE_MODEL)
        # LiteLlm reads ANTHROPIC_API_KEY from the environment automatically.
        return LiteLlm(model=claude_model)

    # Default: native Gemini. ADK resolves the bare string to its Gemini client,
    # which reads GOOGLE_API_KEY (or the Vertex AI env vars) from the environment.
    return os.getenv("ITAILY_GEMINI_MODEL", DEFAULT_GEMINI_MODEL)


def get_model_label() -> str:
    """Human-readable model label stamped onto every work product (``model`` field).

    Must read like the seed data the app already ships (e.g. "gemini-2.5 (ADK)").
    """
    return MODEL_LABEL_CLAUDE if _provider() == "claude" else MODEL_LABEL_GEMINI
