"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Loader2, ClipboardList } from "lucide-react";
import type { EvalRunResponse } from "@/lib/types";
import { runLabel, formatScore } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface RunHistoryProps {
  runs: EvalRunResponse[];
  onViewRun: (run: EvalRunResponse) => void;
}

function ScoreChip({ score }: { score: number }) {
  const color =
    score >= 0.85
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : score >= 0.70
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200";
  return (
    <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums", color)}>
      {formatScore(score)}
    </span>
  );
}

export function RunHistory({ runs, onViewRun }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
        <ClipboardList className="h-7 w-7 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">No evaluation runs yet.</p>
        <p className="text-xs text-muted-foreground/70">Select a dataset above and click Run Evaluation.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_140px_100px_80px_80px_80px_48px] gap-3 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Run</span>
        <span>Dataset</span>
        <span>Status</span>
        <span>Score</span>
        <span>Pass rate</span>
        <span>Date</span>
        <span />
      </div>

      <div className="divide-y">
        {runs.map((run) => {
          const avgScore =
            run.metrics && Object.keys(run.metrics).length > 0
              ? Object.values(run.metrics).reduce((a, b) => a + b, 0) /
                Object.values(run.metrics).length
              : null;

          return (
            <div
              key={run.id}
              className="grid grid-cols-[1fr_140px_100px_80px_80px_80px_48px] items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/20"
            >
              <span className="font-medium truncate">{runLabel(run)}</span>
              <span className="truncate text-muted-foreground text-xs">{run.dataset_name ?? run.dataset_id}</span>
              <span>
                {run.status === "running" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    running
                  </span>
                ) : run.status === "completed" ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                    done
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">{run.status}</Badge>
                )}
              </span>
              <span>
                {avgScore != null ? <ScoreChip score={avgScore} /> : <span className="text-muted-foreground">—</span>}
              </span>
              <span className="text-sm">
                {run.question_count ? (
                  <>
                    <span className="font-medium">{run.pass_count ?? 0}</span>
                    <span className="text-muted-foreground">/{run.question_count}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(run.created_at).toLocaleDateString()}
              </span>
              <span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => onViewRun(run)}
                  disabled={run.status !== "completed"}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
