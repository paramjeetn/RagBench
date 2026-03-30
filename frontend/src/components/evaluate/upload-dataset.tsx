"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileJson, X, Check } from "lucide-react";
import { api } from "@/lib/api";
import type { DatasetSummaryResponse, DocumentResponse } from "@/lib/types";

interface UploadDatasetProps {
  onUploaded: (ds: DatasetSummaryResponse) => void;
}

export function UploadDataset({ onUploaded }: UploadDatasetProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      api.get<DocumentResponse[]>("/api/documents/").then(setDocuments).catch(() => {});
    }
  }, [open]);

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name.trim());
      formData.append("document_ids", JSON.stringify(selectedDocs));
      const ds = await api.upload<DatasetSummaryResponse>(
        "/api/datasets/upload",
        formData
      );
      onUploaded(ds);
      setOpen(false);
      setName("");
      setFile(null);
      setSelectedDocs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" />
        }
      >
        <Upload className="mr-2 h-4 w-4" />
        Upload Dataset
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Evaluation Dataset</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Dataset Name</label>
            <Input
              placeholder="e.g. API Design QA Set"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              JSON File (array of {`{question, ground_truth}`})
            </label>
            <div
              className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 hover:bg-muted/50"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <>
                  <FileJson className="h-4 w-4 text-primary" />
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Click to select a .json file
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {documents.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Scope to Documents (optional)
              </label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                {documents.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/50"
                  >
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        selectedDocs.includes(doc.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                      onClick={() => toggleDoc(doc.id)}
                    >
                      {selectedDocs.includes(doc.id) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <span className="truncate">{doc.filename}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {doc.chunk_count} chunks
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Expected format:{" "}
            <code className="rounded bg-muted px-1">
              {"[{\"question\": \"...\", \"ground_truth\": \"...\"}]"}
            </code>
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleUpload}
            disabled={!file || !name.trim() || uploading}
            className="w-full"
          >
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload Dataset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
