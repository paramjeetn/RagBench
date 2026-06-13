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
        "group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-8 py-12 transition-all duration-200",
        dragging
          ? "border-primary bg-primary/4 scale-[1.02]"
          : "border-border/60 bg-muted/20 hover:border-primary/50 hover:bg-primary/4"
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
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/8 transition-transform group-hover:scale-105">
            {dragging ? (
              <Upload className="h-6 w-6 text-primary" />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              {dragging ? "Drop to upload" : "Drop a file here or click to browse"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-medium">.pdf · .txt · .md · .docx</p>
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
