"""Embedding package for the RAG Eval System."""

from embedding.embedder import (
    EmbedderProtocol,
    FakeEmbedder,
    OpenAIEmbedder,
    SentenceTransformerEmbedder,
    create_embedder,
)

__all__ = [
    "EmbedderProtocol",
    "FakeEmbedder",
    "OpenAIEmbedder",
    "SentenceTransformerEmbedder",
    "create_embedder",
]
