"""Ingestion pipeline for the RAG Eval System.

Handles the full document lifecycle: parse -> chunk -> embed -> store.
"""

import uuid

from config import ChunkStrategy, get_pipeline_config
from embedding.embedder import EmbedderProtocol
from exceptions import IngestionError
from ingestion.chunking import chunk_text
from ingestion.parser import parse_document
from retrieval.sparse import BM25Index
from vectorstore.qdrant_store import VectorStoreProtocol


class IngestionPipeline:
    """Parse, chunk, embed, and store documents in one step."""

    def __init__(
        self,
        embedder: EmbedderProtocol,
        vector_store: VectorStoreProtocol,
        bm25_index: BM25Index,
    ):
        self.embedder = embedder
        self.vector_store = vector_store
        self.bm25 = bm25_index

    async def ingest(
        self, file_bytes: bytes, filename: str, doc_id: str | None = None
    ) -> dict:
        """Parse, chunk, embed, store. Returns dict with doc info.

        If *doc_id* is provided it will be used as the document identifier
        in both the vector store and BM25 index. Otherwise a new UUID is
        generated.
        """
        try:
            config = get_pipeline_config()

            # 1. Parse
            parsed = parse_document(file_bytes, filename)

            # 2. Chunk
            embedding_fn = None
            if config.chunking.strategy == ChunkStrategy.semantic:
                embedding_fn = self.embedder.embed

            chunks = chunk_text(
                parsed.text,
                strategy=config.chunking.strategy,
                chunk_size=config.chunking.chunk_size,
                overlap=config.chunking.overlap,
                embedding_fn=embedding_fn,
            )

            if not chunks:
                raise IngestionError(f"No chunks produced from {filename}")

            # 3. Use provided doc_id or generate one
            if doc_id is None:
                doc_id = str(uuid.uuid4())

            # 4. Embed
            texts = [c.text for c in chunks]
            vectors = await self.embedder.embed(texts)

            # 5. Prepare chunk dicts for storage
            page_count = parsed.metadata.get("page_count", 1)
            chunk_dicts: list[dict] = []
            for i, chunk in enumerate(chunks):
                # Estimate page number from position in text
                page_number = chunk.metadata.get(
                    "page_number",
                    (
                        int(i / max(len(chunks), 1) * page_count) + 1
                        if page_count > 1
                        else 1
                    ),
                )
                chunk_dicts.append(
                    {
                        "text": chunk.text,
                        "source_file": filename,
                        "page_number": page_number,
                        "chunk_index": chunk.index,
                        "chunk_strategy": config.chunking.strategy.value,
                    }
                )

            # 6. Store in vector store
            await self.vector_store.upsert(doc_id, chunk_dicts, vectors)

            # 7. Add to BM25 index
            bm25_docs = [
                {
                    "text": c["text"],
                    "doc_id": doc_id,
                    "source_file": filename,
                    "page_number": c["page_number"],
                    "chunk_index": c["chunk_index"],
                }
                for c in chunk_dicts
            ]
            self.bm25.add_documents(bm25_docs)

            return {
                "doc_id": doc_id,
                "filename": filename,
                "file_type": parsed.file_type,
                "chunk_count": len(chunks),
                "chunk_strategy": config.chunking.strategy.value,
            }
        except IngestionError:
            raise
        except Exception as e:
            raise IngestionError(f"Failed to ingest {filename}: {e}")

    async def delete(self, doc_id: str) -> None:
        """Remove document from vector store and BM25 index."""
        await self.vector_store.delete_by_doc_id(doc_id)
        self.bm25.remove_by_doc_id(doc_id)

    async def reindex_all(
        self, documents: list[dict], file_contents: dict[str, bytes]
    ) -> list[dict]:
        """Re-chunk and re-embed all documents with current config.

        Parameters
        ----------
        documents:
            List of ``{"doc_id": ..., "filename": ...}`` dicts.
        file_contents:
            Map of ``doc_id -> file bytes``.

        Returns
        -------
        list[dict]
            Ingestion result dicts for each successfully processed document.
        """
        # Clear existing data
        await self.vector_store.delete_all()
        await self.vector_store.ensure_collection()
        self.bm25.clear()

        results: list[dict] = []
        for doc in documents:
            doc_id = doc["doc_id"]
            if doc_id in file_contents:
                result = await self.ingest(file_contents[doc_id], doc["filename"])
                results.append(result)

        return results
