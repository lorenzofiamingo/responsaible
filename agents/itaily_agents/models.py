"""Single place that decides which LLM the ADK agents use.

Default: Gemini natively, via ADK's plain *string* model id (ADK resolves a bare
string like ``"gemini-2.5-flash"`` to its built-in Gemini integration).

Switch: set ``ITAILY_MODEL_PROVIDER=claude`` to route every agent through
Anthropic Claude using ADK's LiteLlm wrapper. That is the ONLY line you need to
change models — agents in ``pipeline.py`` call :func:`get_model` and never name a
model directly.

There is also a PRIVACY path: the firm-knowledge agent always runs on an OPEN,
self-hostable model (NVIDIA Nemotron via a NIM endpoint) regardless of the global
provider, so confidential firm material never reaches a third-party API. Call
:func:`get_open_model` for that agent. Set ``ITAILY_MODEL_PROVIDER=nvidia`` to put
the WHOLE pipeline on the open model.

Environment variables (see ``.env.example``):
    ITAILY_MODEL_PROVIDER   "gemini" (default) | "claude" | "nvidia"
    ITAILY_GEMINI_MODEL     override the Gemini model id (optional)
    ITAILY_CLAUDE_MODEL     override the Claude model id (optional)
    ITAILY_NEMOTRON_MODEL   override the Nemotron (NIM) model id (optional)
    NVIDIA_NIM_BASE_URL     NIM endpoint — point at a self-hosted NIM for privacy
    GOOGLE_API_KEY          required when provider=gemini (or use Vertex vars)
    ANTHROPIC_API_KEY       required when provider=claude
    NVIDIA_NIM_API_KEY      required for the open/Nemotron path
"""

from __future__ import annotations

import os

# Sensible current defaults. Override via env if these ids change.
#  - Gemini: a fast, cheap, capable model is plenty for seed generation.
#  - Claude: Opus 4.8 is the strongest reasoning option for legal drafting.
#  - Nemotron: open weights served via NVIDIA NIM (OpenAI-compatible, self-hostable).
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_CLAUDE_MODEL = "anthropic/claude-opus-4-8"
# LiteLLM routes NVIDIA NIM models under the ``nvidia_nim/`` prefix.
DEFAULT_NEMOTRON_MODEL = "nvidia_nim/nvidia/llama-3.3-nemotron-super-49b-v1"

# The "model name" string we stamp onto every work product so the console shows
# which model produced it. Kept here so it stays in sync with the real choice.
MODEL_LABEL_GEMINI = "gemini-2.5 (ADK)"
MODEL_LABEL_CLAUDE = "claude-opus-4-8 (ADK)"
MODEL_LABEL_NEMOTRON = "nemotron (ADK, open)"


def _provider() -> str:
    """Return the normalized provider name ("gemini" | "claude" | "nvidia")."""
    return os.getenv("ITAILY_MODEL_PROVIDER", "gemini").strip().lower()


def _nemotron_model():
    """A ``LiteLlm`` bound to Nemotron on NVIDIA NIM (self-hostable, open weights).

    Imported lazily so a Gemini-only run does not require litellm. ``api_base`` lets
    you point at a PRIVATE NIM deployment so confidential input stays on-perimeter.
    LiteLlm reads ``NVIDIA_NIM_API_KEY`` from the environment automatically.
    """
    from google.adk.models.lite_llm import LiteLlm

    model = os.getenv("ITAILY_NEMOTRON_MODEL", DEFAULT_NEMOTRON_MODEL)
    api_base = os.getenv("NVIDIA_NIM_BASE_URL")
    return LiteLlm(model=model, api_base=api_base) if api_base else LiteLlm(model=model)


def get_model():
    """Return the model object/string to hand to an ADK ``LlmAgent(model=...)``.

    - provider=gemini -> a bare string id (ADK's native Gemini path).
    - provider=claude -> a ``LiteLlm`` instance wrapping the Anthropic model.
    - provider=nvidia -> a ``LiteLlm`` instance wrapping the open Nemotron model.

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

    if provider == "nvidia":
        return _nemotron_model()

    # Default: native Gemini. ADK resolves the bare string to its Gemini client,
    # which reads GOOGLE_API_KEY (or the Vertex AI env vars) from the environment.
    return os.getenv("ITAILY_GEMINI_MODEL", DEFAULT_GEMINI_MODEL)


def get_open_model():
    """The OPEN, self-hostable model for the privacy-sensitive firm-knowledge agent.

    Always Nemotron via NIM, independent of ``ITAILY_MODEL_PROVIDER`` — the firm's
    confidential corpus must never be sent to a third-party model API.
    """
    return _nemotron_model()


def get_model_label() -> str:
    """Human-readable model label stamped onto every work product (``model`` field).

    Must read like the seed data the app already ships (e.g. "gemini-2.5 (ADK)").
    """
    provider = _provider()
    if provider == "claude":
        return MODEL_LABEL_CLAUDE
    if provider == "nvidia":
        return MODEL_LABEL_NEMOTRON
    return MODEL_LABEL_GEMINI
