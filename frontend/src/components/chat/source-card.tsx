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
      className="cursor-pointer rounded-md border border-border/50 p-3 text-xs transition-all duration-200 hover:bg-muted/50 hover:shadow-sm"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
        )}
        <span className="font-medium text-foreground/85">{source.source_file}</span>
        {source.chunk_index != null && (
          <Badge variant="secondary" className="text-[9px] font-medium">
            chunk {source.chunk_index}
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground font-medium">
          {(source.score * 100).toFixed(1)}%
        </span>
      </div>
      {expanded && (
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground/80 leading-relaxed">
          {source.text}
        </p>
      )}
    </div>
  );
}
