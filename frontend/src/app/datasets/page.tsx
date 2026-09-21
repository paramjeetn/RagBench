"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { FolderKanban, Upload, Loader2, FileJson, X, Check, Trash2, Database } from "lucide-react";
import { api } from "@/lib/api";
import type { DatasetSummaryResponse, DocumentResponse } from "@/lib/types";
import { useProjectContext } from "@/context/project-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DatasetsPage() {
  const { activeProject } = useProjectContext();
  const [datasets, setDatasets] = useState<DatasetSummaryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [projectDocs, setProjectDocs] = useState<DocumentResponse[]>([]);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDatasets = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const ds = await api.get<DatasetSummaryResponse[]>(`/api/datasets/?project_id=${activeProject.id}`);
      setDatasets(ds);
    } catch {}
    setLoading(false);
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) { setDatasets([]); setProjectDocs([]); return; }
    loadDatasets();
    api.get<DocumentResponse[]>(`/api/documents/?project_id=${activeProject.id}`)
      .then((docs) => { setProjectDocs(docs); setSelectedDocs(docs.map((d) => d.id)); })
      .catch(() => {});
  }, [activeProject, loadDatasets]);

  const toggleDoc = (id: string) =>
    setSelectedDocs((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || !activeProject) return;
    setUploading(true); setUploadError("");
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("name", uploadName.trim());
      form.append("document_ids", JSON.stringify(selectedDocs));
      form.append("project_id", activeProject.id);
      const ds = await api.upload<DatasetSummaryResponse>("/api/datasets/upload", form);
      setDatasets((prev) => [ds, ...prev]);
      setUploadName(""); setUploadFile(null);
      setSelectedDocs(projectDocs.map((d) => d.id));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dataset? This cannot be undone.")) return;
    await api.del(`/api/datasets/${id}`);
    setDatasets((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }} className="pb-5"
        style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-2" style={{ background: "#E63946" }} />
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">Datasets</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {activeProject ? `Project: ${activeProject.name}` : "Select a project to continue"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* No project guard */}
      {!activeProject ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-4 py-24"
          style={{ border: "3px dashed oklch(0.10 0.01 240)" }}>
          <div className="flex h-16 w-16 items-center justify-center"
            style={{ background: "#F4C542", border: "3px solid oklch(0.10 0.01 240)" }}>
            <FolderKanban className="h-8 w-8 text-black" />
          </div>
          <p className="text-base font-black uppercase tracking-widest">No Project Selected</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Select or create a project from the top-right to manage datasets.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Upload card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }} className="p-5 space-y-4"
            style={{ background: "white", border: "3px solid oklch(0.10 0.01 240)", boxShadow: "8px 8px 0 #E63946" }}>
            <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}>
              <div className="h-5 w-1.5" style={{ background: "#E63946" }} />
              <h2 className="text-sm font-black uppercase tracking-widest">Upload New Dataset</h2>
            </div>

            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              JSON format: <code className="font-mono">[{'{'}&quot;question&quot;: &quot;...&quot;, &quot;ground_truth&quot;: &quot;...&quot;{'}'}]</code>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Name</label>
                <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. API Design QA Set" className="h-9 w-56"
                  style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">File</label>
                <div className="flex items-center gap-2 h-9 px-3 cursor-pointer"
                  style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0, background: "oklch(0.97 0.004 80)" }}
                  onClick={() => fileRef.current?.click()}>
                  {uploadFile ? (
                    <>
                      <FileJson className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium max-w-[140px] truncate">{uploadFile.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" /> Click to select .json
                    </span>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".json" className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </div>
              <motion.button onClick={handleUpload}
                disabled={!uploadFile || !uploadName.trim() || uploading}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                className="inline-flex h-9 items-center gap-2 px-5 text-sm font-black uppercase tracking-wider text-white disabled:opacity-50"
                style={{ background: "#E63946", border: "2px solid oklch(0.10 0.01 240)", boxShadow: "4px 4px 0 oklch(0.10 0.01 240)", borderRadius: 0 }}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload
              </motion.button>
            </div>

            {/* Doc scope selector */}
            {projectDocs.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Scope to documents ({selectedDocs.length}/{projectDocs.length} selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {projectDocs.map((doc) => {
                    const sel = selectedDocs.includes(doc.id);
                    return (
                      <button key={doc.id} onClick={() => toggleDoc(doc.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold transition-all"
                        style={{
                          background: sel ? "#2563EB" : "white",
                          color: sel ? "white" : "oklch(0.10 0.01 240)",
                          border: "2px solid #2563EB",
                          borderRadius: 0,
                        }}>
                        {sel ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-40" />}
                        <span className="max-w-[120px] truncate">{doc.filename}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          </motion.div>

          {/* Dataset list */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-2" style={{ background: "#2563EB" }} />
              <h2 className="text-lg font-black uppercase tracking-widest">Datasets</h2>
              {datasets.length > 0 && (
                <span className="text-xs font-bold text-muted-foreground">{datasets.length} total</span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-10 w-10 border-4 border-bauhaus-yellow" style={{ borderRadius: 0 }} />
              </div>
            ) : datasets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16"
                style={{ border: "3px dashed oklch(0.10 0.01 240)" }}>
                <Database className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No datasets yet</p>
                <p className="text-xs text-muted-foreground">Upload a JSON Q&amp;A dataset above.</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_1fr_48px] gap-3 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Name</span><span>Items</span><span>Created</span><span />
                </div>
                <div className="divide-y">
                  {datasets.map((ds) => (
                    <div key={ds.id} className="grid grid-cols-[1fr_80px_1fr_48px] items-center gap-3 px-4 py-3 hover:bg-muted/20">
                      <div>
                        <p className="text-sm font-bold truncate">{ds.name}</p>
                        {ds.document_ids?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">{ds.document_ids.length} doc{ds.document_ids.length !== 1 ? "s" : ""} scoped</p>
                        )}
                      </div>
                      <span className="text-sm font-black">{ds.item_count} <span className="text-xs font-normal text-muted-foreground">Q&As</span></span>
                      <span className="text-xs text-muted-foreground">{new Date(ds.created_at).toLocaleDateString()}</span>
                      <button onClick={() => handleDelete(ds.id)}
                        className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
