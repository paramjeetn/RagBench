"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import type { DocumentResponse } from "@/lib/types";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentList } from "@/components/documents/document-list";
import { ChunkPreview } from "@/components/documents/chunk-preview";
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

  useEffect(() => { loadDocs(); }, [loadDocs]);

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
              Upload & manage your RAG pipeline docs
            </p>
          </div>
        </div>
      </motion.div>

      {/* Active project badge */}
      {activeProject && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2.5"
          style={{
            background: "#F4C542",
            border: "3px solid oklch(0.10 0.01 240)",
            boxShadow: "4px 4px 0 oklch(0.10 0.01 240)",
          }}
        >
          <span className="text-xs font-black uppercase tracking-widest text-black">Project:</span>
          <span className="text-sm font-black text-black">{activeProject.name}</span>
        </motion.div>
      )}

      {/* Upload zone wrapper */}
      <div
        style={{
          border: "3px solid oklch(0.10 0.01 240)",
          boxShadow: "6px 6px 0 #2563EB",
        }}
      >
        <UploadZone onUploaded={handleUploaded} projectId={activeProject?.id} />
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

      <ChunkPreview
        documentId={viewDoc?.id ?? null}
        filename={viewDoc?.filename ?? ""}
        onClose={() => setViewDoc(null)}
      />
    </div>
  );
}
