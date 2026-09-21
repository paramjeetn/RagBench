"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { FolderKanban } from "lucide-react";
import { api } from "@/lib/api";
import type { DocumentResponse } from "@/lib/types";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentList } from "@/components/documents/document-list";
import { ChunkPreview } from "@/components/documents/chunk-preview";
import { useProjectContext } from "@/context/project-context";

export default function DocumentsPage() {
  const { activeProject } = useProjectContext();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocumentResponse | null>(null);

  const loadDocs = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const docs = await api.get<DocumentResponse[]>(`/api/documents/?project_id=${activeProject.id}`);
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    if (activeProject) {
      loadDocs();
    } else {
      setDocuments([]);
    }
  }, [loadDocs, activeProject]);

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
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="pb-5"
        style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-2" style={{ background: "#2563EB" }} />
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">Documents</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {activeProject ? `Project: ${activeProject.name}` : "Select a project to continue"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Guard: no project selected */}
      {!activeProject ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-4 py-24"
          style={{ border: "3px dashed oklch(0.10 0.01 240)" }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center"
            style={{ background: "#F4C542", border: "3px solid oklch(0.10 0.01 240)" }}
          >
            <FolderKanban className="h-8 w-8 text-black" />
          </div>
          <p className="text-base font-black uppercase tracking-widest text-foreground">No Project Selected</p>
          <p className="text-xs font-medium text-muted-foreground text-center max-w-xs">
            Select or create a project from the top-right dropdown to upload and manage documents.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Upload zone */}
          <div
            style={{
              border: "3px solid oklch(0.10 0.01 240)",
              boxShadow: "6px 6px 0 #2563EB",
            }}
          >
            <UploadZone onUploaded={handleUploaded} projectId={activeProject.id} />
          </div>

          {/* Document list */}
          {loading ? (
            <div className="flex justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-10 w-10 border-4 border-bauhaus-yellow"
                style={{ borderRadius: 0 }}
              />
            </div>
          ) : (
            <DocumentList
              documents={documents}
              onView={setViewDoc}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      <ChunkPreview
        documentId={viewDoc?.id ?? null}
        filename={viewDoc?.filename ?? ""}
        onClose={() => setViewDoc(null)}
      />
    </div>
  );
}
