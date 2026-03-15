"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SourceInfo } from "@/lib/types";

interface SourceCardProps {
  source: SourceInfo;
}

export function SourceCard({ source }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="cursor-pointer rounded-md border p-2 text-xs transition-colors hover:bg-muted/50"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="font-medium">{source.source_file}</span>
        {source.chunk_index != null && (
          <Badge variant="secondary" className="text-[10px]">
            chunk {source.chunk_index}
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {(source.score * 100).toFixed(1)}%
        </span>
      </div>
      {expanded && (
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
          {source.text}
        </p>
      )}
    </div>
  );
}
