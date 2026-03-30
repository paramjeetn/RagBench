"""LLM provider implementations for the RAG generation pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Protocol, runtime_checkable

from exceptions import GenerationError


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
    """OpenAI chat-completion provider (GPT-4o, GPT-3.5-turbo, etc.)."""

    # Cost per 1M tokens (input, output) for common models
    COST_MAP = {
        "gpt-5-nano": (0.10, 0.40),
        "gpt-4o-mini": (0.15, 0.60),
        "gpt-4o": (2.50, 10.00),
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
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
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
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
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
        import asyncio
        from google.genai import types

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=2048,
                ),
            )
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

    if model.startswith("gpt-") or model.startswith("o1") or model.startswith("o3"):
        if not settings.OPENAI_API_KEY:
            import logging
            logging.getLogger(__name__).warning(
                "OPENAI_API_KEY not set — falling back to FakeLLM. "
                "Queries will return placeholder answers."
            )
            return FakeLLM()
        return OpenAILLM(api_key=settings.OPENAI_API_KEY, model=model)
    elif model.startswith("claude-"):
        if not settings.ANTHROPIC_API_KEY:
            import logging
            logging.getLogger(__name__).warning(
                "ANTHROPIC_API_KEY not set — falling back to FakeLLM."
            )
            return FakeLLM()
        return AnthropicLLM(api_key=settings.ANTHROPIC_API_KEY, model=model)
    elif model.startswith("gemini-"):
        if not settings.GEMINI_API_KEY:
            import logging
            logging.getLogger(__name__).warning(
                "GEMINI_API_KEY not set — falling back to FakeLLM."
            )
            return FakeLLM()
        return GeminiLLM(api_key=settings.GEMINI_API_KEY, model=model)
    else:
        # Default to Ollama for anything else (llama3, mistral, etc.)
        return OllamaLLM(base_url=settings.OLLAMA_BASE_URL, model=model)
