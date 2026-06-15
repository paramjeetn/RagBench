"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { DocumentResponse } from "@/lib/types";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentList } from "@/components/documents/document-list";
import { ChunkPreview } from "@/components/documents/chunk-preview";
import { Loader2 } from "lucide-react";
import { useProjectContext } from "@/context/project-context";

export default function DocumentsPage() {
  const { activeProject } = useProjectContext();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDoc, setViewDoc] = useState<DocumentResponse | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      const url = activeProject
        ? `/api/documents/?project_id=${activeProject.id}`
        : "/api/documents/";
      const docs = await api.get<DocumentResponse[]>(url);
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upload and manage documents for your RAG pipeline.
        </p>
      </div>

      {activeProject && (
        <div className="text-xs text-muted-foreground border border-border/50 rounded-md px-3 py-2 bg-muted/20">
          Uploading to project: <span className="font-medium text-foreground">{activeProject.name}</span>
        </div>
      )}
      <UploadZone onUploaded={handleUploaded} projectId={activeProject?.id} />

      {loading ? (
        <div className="flex justify-center py-12">
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
