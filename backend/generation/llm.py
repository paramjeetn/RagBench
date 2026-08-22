"""LLM provider implementations for the RAG generation pipeline."""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass
from typing import AsyncIterator, Protocol, runtime_checkable

from exceptions import GenerationError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exponential backoff helper (used by all API providers)
# ---------------------------------------------------------------------------

async def _call_with_backoff(fn, max_retries: int = 3, base_delay: float = 1.0):
    """Call *fn()* and retry on transient API errors with exponential backoff + jitter.

    Only sleeps when OpenAI/Anthropic/Gemini returns a rate-limit (429) or
    server error (5xx). Any other exception propagates immediately.
    No artificial waiting is added between normal sequential questions.
    """
    for attempt in range(max_retries + 1):
        try:
            return await fn()
        except Exception as exc:
            msg = str(exc).lower()
            is_transient = (
                "429" in msg
                or "rate limit" in msg
                or "rate_limit" in msg
                or "server error" in msg
                or "502" in msg
                or "503" in msg
                or "504" in msg
                or "timeout" in msg
                or "connection" in msg
            )
            if not is_transient or attempt == max_retries:
                raise
            # Exponential backoff: 1s, 2s, 4s  + ±30% jitter
            delay = base_delay * (2 ** attempt) * (0.7 + random.random() * 0.6)
            logger.warning(
                "Transient API error (attempt %d/%d), retrying in %.1fs: %s",
                attempt + 1, max_retries, delay, exc,
            )
            await asyncio.sleep(delay)



@dataclass
class LLMResponse:
    text: str
    tokens_used: int
    model: str
    estimated_cost: float


@runtime_checkable
class LLMProtocol(Protocol):
    async def generate(
        self, system_prompt: str, user_prompt: str
    ) -> LLMResponse: ...

    async def generate_stream(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncIterator[str]: ...


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------


class OpenAILLM:
    """OpenAI chat-completion provider (GPT-4o, GPT-3.5-turbo, gpt-5-nano, etc.)."""

    # Cost per 1M tokens (input, output) — sourced from platform.openai.com/docs/models
    COST_MAP = {
        # --- GPT-5 family ---
        "gpt-5-nano": (0.05, 0.40),           # fastest, cheapest GPT-5
        "gpt-5-mini": (0.40, 1.60),           # near-frontier, cost-sensitive
        "gpt-5": (2.00, 8.00),                # full GPT-5
        "gpt-5-pro": (6.00, 24.00),           # smarter GPT-5
        # --- GPT-5.4 family ---
        "gpt-5.4-nano": (0.20, 1.25),         # cheapest GPT-5.4-class
        "gpt-5.4-mini": (0.75, 4.50),         # strong mini for coding/computer-use
        "gpt-5.4": (2.00, 8.00),              # affordable coding/professional
        "gpt-5.4-pro": (6.00, 24.00),         # smarter GPT-5.4
        # --- GPT-5.6 family (current recommended) ---
        "gpt-5.6-luna": (0.40, 1.60),         # cost-sensitive high-volume
        "gpt-5.6-terra": (1.50, 6.00),        # balance intelligence and cost
        "gpt-5.6-sol": (3.00, 12.00),         # flagship, complex reasoning
        # --- GPT-4.1 family ---
        "gpt-4.1-nano": (0.10, 0.40),         # fastest GPT-4.1, 1M context
        "gpt-4.1-mini": (0.40, 1.60),         # smaller/faster GPT-4.1
        "gpt-4.1": (2.00, 8.00),              # smartest non-reasoning
        # --- GPT-4o family ---
        "gpt-4o-mini": (0.15, 0.60),          # fast affordable small model
        "gpt-4o": (2.50, 10.00),              # fast intelligent flexible
        # --- o-series reasoning ---
        "o4-mini": (1.10, 4.40),              # fast cost-efficient reasoning
        "o3-mini": (1.10, 4.40),              # small o3 alternative
        "o3": (10.00, 40.00),                 # strong reasoning
        "o1-mini": (1.10, 4.40),              # small o1 alternative
        "o1": (15.00, 60.00),                 # full o1 reasoning
        # --- Legacy ---
        "gpt-4-turbo": (10.00, 30.00),
        "gpt-3.5-turbo": (0.50, 1.50),
    }

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        import openai

        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model

    def _estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        costs = self.COST_MAP.get(self.model, (1.0, 3.0))
        return (input_tokens * costs[0] + output_tokens * costs[1]) / 1_000_000

    async def generate(
        self, system_prompt: str, user_prompt: str
    ) -> LLMResponse:
        async def _call():
            return await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        try:
            response = await _call_with_backoff(_call)
            choice = response.choices[0]
            usage = response.usage
            return LLMResponse(
                text=choice.message.content or "",
                tokens_used=usage.total_tokens if usage else 0,
                model=self.model,
                estimated_cost=self._estimate_cost(
                    usage.prompt_tokens if usage else 0,
                    usage.completion_tokens if usage else 0,
                ),
            )
        except GenerationError:
            raise
        except Exception as e:
            raise GenerationError(f"OpenAI generation failed: {e}")


    async def generate_stream(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncIterator[str]:
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                stream=True,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except GenerationError:
            raise
        except Exception as e:
            raise GenerationError(f"OpenAI streaming failed: {e}")


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------


class AnthropicLLM:
    """Anthropic Claude provider."""

    COST_MAP = {
        "claude-sonnet-4-6": (3.00, 15.00),
        "claude-haiku-4-5-20251001": (0.80, 4.00),
        "claude-opus-4-6": (15.00, 75.00),
    }

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        import anthropic

        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    def _estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        costs = self.COST_MAP.get(self.model, (3.0, 15.0))
        return (input_tokens * costs[0] + output_tokens * costs[1]) / 1_000_000

    async def generate(
        self, system_prompt: str, user_prompt: str
    ) -> LLMResponse:
        async def _call():
            return await self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
        try:
            response = await _call_with_backoff(_call)
            text = response.content[0].text if response.content else ""
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            return LLMResponse(
                text=text,
                tokens_used=input_tokens + output_tokens,
                model=self.model,
                estimated_cost=self._estimate_cost(input_tokens, output_tokens),
            )
        except GenerationError:
            raise
        except Exception as e:
            raise GenerationError(f"Anthropic generation failed: {e}")

    async def generate_stream(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncIterator[str]:
        try:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except GenerationError:
            raise
        except Exception as e:
            raise GenerationError(f"Anthropic streaming failed: {e}")


# ---------------------------------------------------------------------------
# Ollama (local models)
# ---------------------------------------------------------------------------


class OllamaLLM:
    """Ollama local model provider (Llama 3, Mistral, etc.)."""

    def __init__(
        self, base_url: str = "http://localhost:11434", model: str = "llama3"
    ):
        import httpx

        self.client = httpx.AsyncClient(base_url=base_url, timeout=120.0)
        self.model = model

    async def generate(
        self, system_prompt: str, user_prompt: str
    ) -> LLMResponse:
        try:
            response = await self.client.post(
                "/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()
            text = data.get("message", {}).get("content", "")
            tokens = data.get("eval_count", 0) + data.get("prompt_eval_count", 0)
            return LLMResponse(
                text=text, tokens_used=tokens, model=self.model, estimated_cost=0.0
            )
        except GenerationError:
            raise
        except Exception as e:
            raise GenerationError(f"Ollama generation failed: {e}")

    async def generate_stream(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncIterator[str]:
        import json as json_mod

        try:
            async with self.client.stream(
                "POST",
                "/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": True,
                },
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        data = json_mod.loads(line)
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content
        except GenerationError:
            raise
        except Exception as e:
            raise GenerationError(f"Ollama streaming failed: {e}")


# ---------------------------------------------------------------------------
# Google Gemini
# ---------------------------------------------------------------------------


class GeminiLLM:
    """Google Gemini provider (gemini-2.5-flash, gemini-2.0-flash-lite, etc.)."""

    COST_MAP = {
        "gemini-2.5-flash": (0.15, 0.60),
        "gemini-2.0-flash-lite": (0.075, 0.30),
        "gemini-2.0-flash": (0.10, 0.40),
        "gemini-1.5-flash": (0.075, 0.30),
        "gemini-1.5-pro": (1.25, 5.00),
    }

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        from google import genai

        self.client = genai.Client(api_key=api_key)
        self.model = model

    def _estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        costs = self.COST_MAP.get(self.model, (0.15, 0.60))
        return (input_tokens * costs[0] + output_tokens * costs[1]) / 1_000_000

    async def generate(
        self, system_prompt: str, user_prompt: str
    ) -> LLMResponse:
        from google.genai import types

        async def _call():
            return await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=2048,
                ),
            )
        try:
            response = await _call_with_backoff(_call)
            text = response.text or ""
            usage = response.usage_metadata
            input_tokens = usage.prompt_token_count if usage else 0
            output_tokens = usage.candidates_token_count if usage else 0
            return LLMResponse(
                text=text,
                tokens_used=input_tokens + output_tokens,
                model=self.model,
                estimated_cost=self._estimate_cost(input_tokens, output_tokens),
            )
        except GenerationError:
            raise
        except Exception as e:
            raise GenerationError(f"Gemini generation failed: {e}")

    async def generate_stream(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncIterator[str]:
        import asyncio
        from google.genai import types

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content_stream,
                model=self.model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=2048,
                ),
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except GenerationError:
            raise
        except Exception as e:
            raise GenerationError(f"Gemini streaming failed: {e}")


# ---------------------------------------------------------------------------
# Fake (for testing)
# ---------------------------------------------------------------------------


class FakeLLM:
    """For testing -- returns a canned response."""

    def __init__(
        self,
        response_text: str = (
            "This is a test response based on the provided context. "
            "[Source: test.pdf, chunk 0]"
        ),
    ):
        self.response_text = response_text

    async def generate(
        self, system_prompt: str, user_prompt: str
    ) -> LLMResponse:
        return LLMResponse(
            text=self.response_text,
            tokens_used=100,
            model="fake",
            estimated_cost=0.0,
        )

    async def generate_stream(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncIterator[str]:
        for word in self.response_text.split():
            yield word + " "


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def create_llm(model: str, settings=None) -> LLMProtocol:
    """Factory: create LLM based on model name prefix or provider detection.

    Falls back to FakeLLM when no API key is available so the pipeline
    can still run (using heuristic evaluation metrics) without credentials.
    """
    if settings is None:
        from config import get_settings

        settings = get_settings()

    from api.middleware import (
        get_effective_anthropic_key,
        get_effective_gemini_key,
        get_effective_openai_key,
    )

    if model.startswith("gpt-") or model.startswith("o1") or model.startswith("o3") or model.startswith("o4"):
        openai_key = get_effective_openai_key(settings.OPENAI_API_KEY)
        if not openai_key:
            raise GenerationError(
                "OPENAI_API_KEY not configured. Add it to .env to use GPT models."
            )
        return OpenAILLM(api_key=openai_key, model=model)
    elif model.startswith("claude-"):
        anthropic_key = get_effective_anthropic_key(settings.ANTHROPIC_API_KEY)
        if not anthropic_key:
            raise GenerationError(
                "ANTHROPIC_API_KEY not configured. Add it to .env to use Claude models."
            )
        return AnthropicLLM(api_key=anthropic_key, model=model)
    elif model.startswith("gemini-"):
        gemini_key = get_effective_gemini_key(settings.GEMINI_API_KEY)
        if not gemini_key:
            raise GenerationError(
                "GEMINI_API_KEY not configured. Add it to .env to use Gemini models."
            )
        return GeminiLLM(api_key=gemini_key, model=model)
    else:
        # Default to Ollama for anything else (llama3, mistral, etc.)
        return OllamaLLM(base_url=settings.OLLAMA_BASE_URL, model=model)
