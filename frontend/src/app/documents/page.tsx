"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { DocumentResponse } from "@/lib/types";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentList } from "@/components/documents/document-list";
import { ChunkPreview } from "@/components/documents/chunk-preview";
import { Loader2 } from "lucide-react";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDoc, setViewDoc] = useState<DocumentResponse | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      const docs = await api.get<DocumentResponse[]>("/api/documents/");
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUploaded = (doc: DocumentResponse) => {
    setDocuments((prev) => [doc, ...prev]);
  };

  const handleDelete = async (id: string) => {
    await api.del(`/api/documents/${id}`);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Documents</h1>
      <UploadZone onUploaded={handleUploaded} />

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DocumentList
          documents={documents}
          onView={setViewDoc}
          onDelete={handleDelete}
        />
      )}

      <ChunkPreview
        documentId={viewDoc?.id ?? null}
        filename={viewDoc?.filename ?? ""}
        onClose={() => setViewDoc(null)}
      />
    </div>
  );
}
