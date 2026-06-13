"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, FileText } from "lucide-react";
import { api } from "@/lib/api";
import type { DocumentResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onUploaded: (doc: DocumentResponse) => void;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const doc = await api.upload<DocumentResponse>("/api/documents/", formData);
        onUploaded(doc);
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-10 transition-all duration-150",
        dragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/20 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      {uploading ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Uploading and indexing…</p>
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
            {dragging ? (
              <Upload className="h-5 w-5 text-primary" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {dragging ? "Drop to upload" : "Drop a file here or click to browse"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">.pdf · .txt · .md · .docx</p>
          </div>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.md,.docx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
    </div>
  );
}
