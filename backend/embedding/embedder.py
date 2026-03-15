"""Embedding providers for the RAG Eval System."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import random
from typing import Protocol, runtime_checkable

import openai

from config import EmbeddingConfig, Settings, get_pipeline_config, get_settings
from exceptions import EmbeddingError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class EmbedderProtocol(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...

    @property
    def dimension(self) -> int:
        ...


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------

_OPENAI_BATCH_LIMIT = 100


class OpenAIEmbedder:
    """Generates embeddings via the OpenAI API."""

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
        dimension: int = 1536,
    ) -> None:
        self._client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed *texts* in batches of 100 (OpenAI limit).

        Returns a list of embedding vectors in the same order as the input.
        """
        if not texts:
            return []

        all_embeddings: list[list[float]] = []
        try:
            for start in range(0, len(texts), _OPENAI_BATCH_LIMIT):
                batch = texts[start : start + _OPENAI_BATCH_LIMIT]
                response = await self._client.embeddings.create(
                    input=batch,
                    model=self.model,
                )
                # Responses may not be in order; sort by index to be safe.
                sorted_data = sorted(response.data, key=lambda d: d.index)
                all_embeddings.extend([d.embedding for d in sorted_data])
        except openai.OpenAIError as exc:
            logger.error("OpenAI embedding request failed: %s", exc)
            raise EmbeddingError(
                message=f"OpenAI embedding request failed: {exc}"
            ) from exc

        return all_embeddings


# ---------------------------------------------------------------------------
# Google Gemini
# ---------------------------------------------------------------------------

_GEMINI_BATCH_LIMIT = 100


class GeminiEmbedder:
    """Generates embeddings via the Google Gemini API."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-embedding-001",
        dimension: int = 768,
    ) -> None:
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self.model = model
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        all_embeddings: list[list[float]] = []
        try:
            from google.genai import types

            embed_config = types.EmbedContentConfig(
                output_dimensionality=self._dimension
            )

            for start in range(0, len(texts), _GEMINI_BATCH_LIMIT):
                batch = texts[start : start + _GEMINI_BATCH_LIMIT]
                response = await asyncio.to_thread(
                    self._client.models.embed_content,
                    model=self.model,
                    contents=batch,
                    config=embed_config,
                )
                all_embeddings.extend(
                    [e.values for e in response.embeddings]
                )
        except Exception as exc:
            logger.error("Gemini embedding request failed: %s", exc)
            raise EmbeddingError(
                message=f"Gemini embedding request failed: {exc}"
            ) from exc

        return all_embeddings


# ---------------------------------------------------------------------------
# SentenceTransformer (local / offline)
# ---------------------------------------------------------------------------


class SentenceTransformerEmbedder:
    """Generates embeddings using a local SentenceTransformer model.

    The model is lazily loaded on the first call to ``embed`` so that import
    time stays fast and the heavy ``sentence_transformers`` dependency is only
    required when this embedder is actually used.
    """

    _MODEL_DIMENSIONS: dict[str, int] = {
        "all-MiniLM-L6-v2": 384,
        "all-MiniLM-L12-v2": 384,
        "all-mpnet-base-v2": 768,
    }

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.model_name = model_name
        self._model = None  # lazy-loaded
        self._dimension = self._MODEL_DIMENSIONS.get(model_name, 384)

    @property
    def dimension(self) -> int:
        return self._dimension

    def _load_model(self):
        """Load the SentenceTransformer model (called once)."""
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self.model_name)
        # Update dimension from the actual model if possible.
        dim = self._model.get_sentence_embedding_dimension()
        if dim is not None:
            self._dimension = int(dim)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if self._model is None:
            self._load_model()

        try:
            embeddings = await asyncio.to_thread(
                self._model.encode, texts, convert_to_numpy=True
            )
            return [vec.tolist() for vec in embeddings]
        except Exception as exc:
            logger.error("SentenceTransformer embedding failed: %s", exc)
            raise EmbeddingError(
                message=f"SentenceTransformer embedding failed: {exc}"
            ) from exc


# ---------------------------------------------------------------------------
# Fake (testing)
# ---------------------------------------------------------------------------


class FakeEmbedder:
    """Deterministic fake embedder for tests.

    Produces random-looking vectors seeded by a hash of each input text, so
    the same text always yields the same vector.
    """

    def __init__(self, dimension: int = 1536) -> None:
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        result: list[list[float]] = []
        for text in texts:
            seed = int(hashlib.sha256(text.encode()).hexdigest(), 16) % (2**32)
            rng = random.Random(seed)
            result.append([rng.gauss(0, 1) for _ in range(self._dimension)])
        return result


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def create_embedder(
    settings: Settings | None = None,
    embedding_config: EmbeddingConfig | None = None,
) -> EmbedderProtocol:
    """Return an embedder based on the embedding config and available API keys.

    If *embedding_config* is provided it determines which provider to use.
    Otherwise the config is read from PipelineConfig, falling back to
    auto-detection based on available API keys.
    """
    if settings is None:
        settings = get_settings()
    if embedding_config is None:
        embedding_config = get_pipeline_config().embedding

    provider = embedding_config.provider.value
    model = embedding_config.model
    dimension = embedding_config.dimension

    if provider == "openai":
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise EmbeddingError(message="OpenAI API key is required for OpenAI embeddings")
        return OpenAIEmbedder(api_key=api_key, model=model, dimension=dimension)
    elif provider == "gemini":
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise EmbeddingError(message="Gemini API key is required for Gemini embeddings")
        return GeminiEmbedder(api_key=api_key, model=model, dimension=dimension)
    else:
        return SentenceTransformerEmbedder(model_name=model)
