"""Prompt templates for the RAG generation pipeline."""

SYSTEM_PROMPT = """You are a helpful assistant that answers questions based ONLY on the provided context.

Rules:
1. Answer ONLY from the context provided. Do not use external knowledge.
2. If the context doesn't contain enough information, say "I don't have enough information to answer this question based on the provided documents."
3. Cite your sources using [Source: filename, chunk N] format.
4. Be concise and direct."""


def build_query_prompt(question: str, chunks: list[dict]) -> str:
    """Build the user prompt with context chunks.

    Each chunk dict has: text, source_file, chunk_index
    """
    context_parts = []
    for i, chunk in enumerate(chunks):
        source = chunk.get("source_file", "unknown")
        idx = chunk.get("chunk_index", i)
        context_parts.append(f"[Source: {source}, chunk {idx}]\n{chunk['text']}")

    context = "\n\n---\n\n".join(context_parts)

    return f"""Context:
{context}

Question: {question}

Answer the question using ONLY the context above. Cite sources."""
