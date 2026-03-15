"""Phase 6 – LLM Generation: prompt templates and multi-provider LLM clients."""

from generation.llm import (
    AnthropicLLM,
    FakeLLM,
    LLMProtocol,
    LLMResponse,
    OllamaLLM,
    OpenAILLM,
    create_llm,
)
from generation.prompts import SYSTEM_PROMPT, build_query_prompt

__all__ = [
    "SYSTEM_PROMPT",
    "build_query_prompt",
    "LLMResponse",
    "LLMProtocol",
    "OpenAILLM",
    "AnthropicLLM",
    "OllamaLLM",
    "FakeLLM",
    "create_llm",
]
