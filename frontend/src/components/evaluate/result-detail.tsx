"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatScore } from "@/lib/utils";
import type { EvalRunResponse } from "@/lib/types";
import { SourceCard } from "@/components/chat/source-card";
import { ChevronLeft, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultDetailProps {
  run: EvalRunResponse;
  onBack: () => void;
}

function MetricPill({ name, value }: { name: string; value: number }) {
  const color =
    value >= 0.85
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : value >= 0.70
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", color)}>
      {name.replace(/_/g, " ")}: {formatScore(value)}
    </span>
  );
}

export function ResultDetail({ run, onBack }: ResultDetailProps) {
  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to history
      </button>

      {/* Summary metrics */}
      {run.metrics && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(run.metrics).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border/50 bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
              <p
                className={cn(
                  "mt-2.5 text-3xl font-bold tabular-nums",
                  value >= 0.85 ? "text-emerald-600" : value >= 0.70 ? "text-amber-500" : "text-red-500"
                )}
              >
                {formatScore(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pass rate */}
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold">
          Results
        </h3>
        <span className="text-sm text-muted-foreground">
          {run.pass_count ?? 0}/{run.question_count ?? 0} passed
        </span>
      </div>

      <ScrollArea className="h-[520px]">
        <div className="space-y-3 pr-4">
          {run.results?.map((result, i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3 border-b border-border/50 bg-muted/20 px-4 py-3.5">
                <p className="text-sm font-medium leading-relaxed">
                  <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                  {result.question}
                </p>
                {result.passed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    PASS
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-red-500">
                    <XCircle className="h-4 w-4" />
                    FAIL
                  </span>
                )}
              </div>

              <div className="space-y-4 px-4 py-3.5 text-sm">
                {/* Ground truth */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ground Truth
                  </p>
                  <p className="text-foreground/80 leading-relaxed">{result.ground_truth}</p>
                </div>

                {/* Generated answer */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Generated Answer
                  </p>
                  <p className="text-foreground/80 leading-relaxed">{result.generated_answer}</p>
                </div>

                {/* Failure reason */}
                {result.failure_reason && (
                  <div className="rounded-md border border-red-200/50 bg-red-50/40 px-3 py-2.5 shadow-sm">
                    <p className="text-xs font-semibold text-red-700 mb-1">Failure Reason</p>
                    <p className="text-xs text-red-700/80">{result.failure_reason}</p>
                  </div>
                )}

                {/* Retrieved chunks */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Retrieved Chunks ({result.retrieved_chunks?.length ?? 0})
                  </p>
                  {result.retrieved_chunks?.length > 0 ? (
                    <div className="space-y-1.5">
                      {result.retrieved_chunks.map((chunk, j) => (
                        <SourceCard key={j} source={chunk} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/70">No chunks retrieved.</p>
                  )}
                </div>

                {/* Metric pills */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                  {Object.entries(result.metrics).map(([key, value]) => (
                    <MetricPill key={key} name={key} value={value} />
                  ))}
                  <Badge variant="outline" className="text-xs text-muted-foreground font-medium">
                    {result.latency_ms}ms
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
