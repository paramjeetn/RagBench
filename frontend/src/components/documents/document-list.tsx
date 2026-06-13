"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, FileText } from "lucide-react";
import type { DocumentResponse } from "@/lib/types";

interface DocumentListProps {
  documents: DocumentResponse[];
  onView: (doc: DocumentResponse) => void;
  onDelete: (id: string) => void;
}

export function DocumentList({ documents, onView, onDelete }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-14 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">No documents uploaded yet.</p>
        <p className="text-xs text-muted-foreground/70">Upload a PDF, TXT, MD, or DOCX file above.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_80px_60px_100px_90px_80px] gap-4 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Filename</span>
        <span>Type</span>
        <span>Chunks</span>
        <span>Strategy</span>
        <span>Uploaded</span>
        <span className="text-right">Actions</span>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="grid grid-cols-[1fr_80px_60px_100px_90px_80px] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/20"
          >
            <span className="flex items-center gap-2 font-medium truncate">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <span className="truncate">{doc.filename}</span>
            </span>
            <span>
              <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                {doc.file_type}
              </Badge>
            </span>
            <span className="tabular-nums text-muted-foreground">{doc.chunk_count}</span>
            <span className="text-muted-foreground">{doc.chunk_strategy}</span>
            <span className="text-muted-foreground">
              {new Date(doc.uploaded_at).toLocaleDateString()}
            </span>
            <span className="flex justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => onView(doc)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(doc.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
