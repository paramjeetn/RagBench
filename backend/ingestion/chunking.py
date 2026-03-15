"""Text chunking engine for the RAG Eval System.

Provides multiple chunking strategies: fixed-size, recursive,
semantic, and document-aware.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Callable

from config import ChunkStrategy


@dataclass
class Chunk:
    """A single chunk of text with positional index and metadata."""

    text: str
    index: int
    metadata: dict = field(default_factory=dict)  # page_number, source info


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on common delimiters."""
    # Split on ". ", "! ", "? ", and newlines while keeping the delimiter
    # attached to the preceding sentence.
    parts = re.split(r"(?<=[.!?])\s+|\n", text)
    return [s.strip() for s in parts if s.strip()]


# ---------------------------------------------------------------------------
# Strategy implementations
# ---------------------------------------------------------------------------


def chunk_fixed(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[Chunk]:
    """Simple character-level sliding window chunking.

    Produces sequential, potentially overlapping chunks of up to
    ``chunk_size`` characters.  Each chunk is stripped of leading/trailing
    whitespace.
    """
    chunks: list[Chunk] = []
    start = 0
    idx = 0

    while start < len(text):
        end = start + chunk_size
        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append(Chunk(text=chunk_text, index=idx))
            idx += 1
        # Advance by (chunk_size - overlap) so the next window overlaps.
        step = max(chunk_size - overlap, 1)
        start += step

    return chunks


def chunk_recursive(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[Chunk]:
    """Recursively split text respecting paragraph/sentence boundaries.

    Tries separators in priority order: ``["\\n\\n", "\\n", ". ", " ", ""]``.
    Pieces that exceed ``chunk_size`` are recursively split with the next
    separator.  The final pieces are reassembled into overlapping chunks.
    """
    separators = ["\n\n", "\n", ". ", " ", ""]

    def _recursive_split(txt: str, sep_idx: int) -> list[str]:
        """Return a list of text pieces each <= chunk_size."""
        if len(txt) <= chunk_size:
            return [txt] if txt.strip() else []

        if sep_idx >= len(separators):
            # Last resort: hard character split.
            pieces = []
            for i in range(0, len(txt), chunk_size):
                piece = txt[i : i + chunk_size]
                if piece.strip():
                    pieces.append(piece)
            return pieces

        sep = separators[sep_idx]
        if sep == "":
            # Character-level split (fallback).
            pieces = []
            for i in range(0, len(txt), chunk_size):
                piece = txt[i : i + chunk_size]
                if piece.strip():
                    pieces.append(piece)
            return pieces

        parts = txt.split(sep)
        result: list[str] = []
        for part in parts:
            if not part.strip():
                continue
            if len(part) <= chunk_size:
                result.append(part)
            else:
                # This piece is too large; split with the next separator.
                result.extend(_recursive_split(part, sep_idx + 1))
        return result

    pieces = _recursive_split(text, 0)

    # Reassemble pieces into chunks of up to chunk_size, respecting overlap.
    chunks: list[Chunk] = []
    idx = 0
    current = ""

    for piece in pieces:
        candidate = (current + " " + piece).strip() if current else piece
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            # Flush current chunk.
            if current.strip():
                chunks.append(Chunk(text=current.strip(), index=idx))
                idx += 1
            # Overlap: carry the tail of the previous chunk.
            if overlap > 0 and current:
                tail = current[-overlap:]
                current = (tail + " " + piece).strip()
            else:
                current = piece
            # If current still exceeds chunk_size (single huge piece), flush.
            if len(current) > chunk_size:
                chunks.append(Chunk(text=current[:chunk_size].strip(), index=idx))
                idx += 1
                current = current[chunk_size - overlap :] if overlap else ""

    if current.strip():
        chunks.append(Chunk(text=current.strip(), index=idx))

    return chunks


def chunk_semantic(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    embedding_fn: Callable | None = None,
) -> list[Chunk]:
    """Semantic chunking based on sentence similarity.

    1. Split text into sentences.
    2. Group consecutive sentences into initial chunks of roughly
       ``chunk_size`` characters.
    3. If ``embedding_fn`` is provided, compute embeddings per initial chunk
       and merge adjacent chunks whose cosine similarity exceeds 0.8.
    4. If ``embedding_fn`` is *not* provided, fall back to recursive chunking.

    ``embedding_fn`` should accept a ``list[str]`` and return a
    ``list[list[float]]``.
    """
    if embedding_fn is None:
        return chunk_recursive(text, chunk_size=chunk_size, overlap=overlap)

    sentences = _split_sentences(text)
    if not sentences:
        return []

    # --- Step 2: group sentences into initial groups of ~chunk_size chars ---
    groups: list[str] = []
    current_group: list[str] = []
    current_len = 0

    for sentence in sentences:
        addition = len(sentence) + (1 if current_group else 0)
        if current_len + addition > chunk_size and current_group:
            groups.append(" ".join(current_group))
            current_group = []
            current_len = 0
        current_group.append(sentence)
        current_len += addition

    if current_group:
        groups.append(" ".join(current_group))

    if len(groups) <= 1:
        return [Chunk(text=g.strip(), index=i) for i, g in enumerate(groups) if g.strip()]

    # --- Step 3: compute embeddings and merge similar adjacent groups ---
    embeddings = embedding_fn(groups)

    merged: list[str] = [groups[0]]
    merged_embeddings: list[list[float]] = [embeddings[0]]

    for i in range(1, len(groups)):
        sim = _cosine_similarity(merged_embeddings[-1], embeddings[i])
        candidate = merged[-1] + " " + groups[i]
        if sim > 0.8 and len(candidate) <= chunk_size * 2:
            merged[-1] = candidate
            # Recompute the embedding for the merged chunk as the average.
            dim = len(embeddings[i])
            avg = [
                (merged_embeddings[-1][d] + embeddings[i][d]) / 2
                for d in range(dim)
            ]
            merged_embeddings[-1] = avg
        else:
            merged.append(groups[i])
            merged_embeddings.append(embeddings[i])

    return [
        Chunk(text=chunk_text.strip(), index=idx)
        for idx, chunk_text in enumerate(merged)
        if chunk_text.strip()
    ]


def chunk_document_aware(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[Chunk]:
    """Document-structure-aware chunking.

    Identifies structural markers (Markdown headers, numbered sections,
    "Chapter" headings, horizontal rules) and splits on those boundaries
    first.  Each section is then recursively chunked.  The section header
    is stored in each chunk's ``metadata["section_header"]``.
    """
    # Pattern matches markdown headers, "Chapter N" lines, and horizontal rules.
    header_pattern = re.compile(
        r"^(?P<header>#{1,6}\s+.+|Chapter\s+\d+.*|\d+\.\s+.+|---+|===+|\*\*\*+)$",
        re.MULTILINE,
    )

    sections: list[tuple[str, str]] = []  # (header, body)
    last_end = 0
    current_header = ""

    for match in header_pattern.finditer(text):
        # Everything before this match belongs to the previous section.
        body = text[last_end : match.start()]
        if body.strip():
            sections.append((current_header, body.strip()))
        current_header = match.group("header").strip()
        last_end = match.end()

    # Remaining text after the last header.
    tail = text[last_end:]
    if tail.strip():
        sections.append((current_header, tail.strip()))

    # If no structural markers were found, treat the whole text as one section.
    if not sections:
        sections = [("", text)]

    # Recursively chunk each section.
    all_chunks: list[Chunk] = []
    global_idx = 0

    for header, body in sections:
        sub_chunks = chunk_recursive(body, chunk_size=chunk_size, overlap=overlap)
        for sc in sub_chunks:
            all_chunks.append(
                Chunk(
                    text=sc.text,
                    index=global_idx,
                    metadata={"section_header": header} if header else {},
                )
            )
            global_idx += 1

    return all_chunks


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

_STRATEGY_MAP = {
    ChunkStrategy.fixed: lambda txt, cs, ov, ef: chunk_fixed(txt, cs, ov),
    ChunkStrategy.recursive: lambda txt, cs, ov, ef: chunk_recursive(txt, cs, ov),
    ChunkStrategy.semantic: lambda txt, cs, ov, ef: chunk_semantic(txt, cs, ov, ef),
    ChunkStrategy.document_aware: lambda txt, cs, ov, ef: chunk_document_aware(txt, cs, ov),
}


def chunk_text(
    text: str,
    strategy: ChunkStrategy,
    chunk_size: int = 500,
    overlap: int = 50,
    embedding_fn: Callable | None = None,
) -> list[Chunk]:
    """Dispatch to the appropriate chunking function based on *strategy*.

    Parameters
    ----------
    text:
        The full document text to chunk.
    strategy:
        A ``ChunkStrategy`` enum member selecting the algorithm.
    chunk_size:
        Target maximum number of characters per chunk.
    overlap:
        Number of overlapping characters between consecutive chunks.
    embedding_fn:
        Optional callable for the semantic strategy.  Accepts a
        ``list[str]`` and returns ``list[list[float]]``.

    Returns
    -------
    list[Chunk]
        Ordered list of text chunks with sequential indices.
    """
    handler = _STRATEGY_MAP.get(strategy)
    if handler is None:
        raise ValueError(f"Unknown chunking strategy: {strategy}")
    return handler(text, chunk_size, overlap, embedding_fn)
