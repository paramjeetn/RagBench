"""Request-scoped API key override middleware.

Allows cloud users to pass their own LLM API keys via request headers.
These override env-var settings for the duration of the request only.
Headers checked:
  X-Gemini-Api-Key
  X-Openai-Api-Key
  X-Anthropic-Api-Key
  X-Qdrant-Api-Key
"""

from contextvars import ContextVar
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# Per-request API key overrides
_request_gemini_key: ContextVar[str | None] = ContextVar("request_gemini_key", default=None)
_request_openai_key: ContextVar[str | None] = ContextVar("request_openai_key", default=None)
_request_anthropic_key: ContextVar[str | None] = ContextVar("request_anthropic_key", default=None)
_request_qdrant_key: ContextVar[str | None] = ContextVar("request_qdrant_key", default=None)


class ApiKeyHeaderMiddleware(BaseHTTPMiddleware):
    """Extract API keys from request headers and store in context vars."""

    async def dispatch(self, request: Request, call_next) -> Response:
        gemini = request.headers.get("X-Gemini-Api-Key")
        openai = request.headers.get("X-Openai-Api-Key")
        anthropic = request.headers.get("X-Anthropic-Api-Key")
        qdrant = request.headers.get("X-Qdrant-Api-Key")

        tokens = []
        if gemini:
            tokens.append(_request_gemini_key.set(gemini))
        if openai:
            tokens.append(_request_openai_key.set(openai))
        if anthropic:
            tokens.append(_request_anthropic_key.set(anthropic))
        if qdrant:
            tokens.append(_request_qdrant_key.set(qdrant))

        try:
            response = await call_next(request)
        finally:
            for token in tokens:
                token.var.reset(token)

        return response


def get_effective_gemini_key(env_key: str | None) -> str | None:
    """Return request-scoped key if present, else fall back to env var."""
    return _request_gemini_key.get() or env_key


def get_effective_openai_key(env_key: str | None) -> str | None:
    return _request_openai_key.get() or env_key


def get_effective_anthropic_key(env_key: str | None) -> str | None:
    return _request_anthropic_key.get() or env_key


def get_effective_qdrant_key(env_key: str | None) -> str | None:
    return _request_qdrant_key.get() or env_key
