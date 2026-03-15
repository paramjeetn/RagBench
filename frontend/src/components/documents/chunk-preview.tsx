"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { DocumentDetailResponse } from "@/lib/types";

interface ChunkPreviewProps {
  documentId: string | null;
  filename: string;
  onClose: () => void;
}

export function ChunkPreview({ documentId, filename, onClose }: ChunkPreviewProps) {
  const [detail, setDetail] = useState<DocumentDetailResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    if (!documentId) return;
    setLoading(true);
    setPage(1);
    api
      .get<DocumentDetailResponse>(
        `/api/documents/${documentId}?page=1&page_size=${pageSize}`
      )
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => {
    if (!documentId || page === 1) return;
    setLoading(true);
    api
      .get<DocumentDetailResponse>(
        `/api/documents/${documentId}?page=${page}&page_size=${pageSize}`
      )
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [documentId, page]);

  const totalPages = detail ? Math.ceil(detail.chunks.total / pageSize) : 0;

  return (
    <Dialog open={!!documentId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chunks: {filename}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : detail ? (
          <>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {detail.chunks.items.map((chunk) => (
                  <div
                    key={chunk.index}
                    className="rounded-md border p-3"
                  >
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      Chunk {chunk.index}
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{chunk.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({detail.chunks.total} chunks)
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
