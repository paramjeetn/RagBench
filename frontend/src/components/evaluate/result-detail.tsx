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
    <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", color)}>
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
            <div key={key} className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
              <p
                className={cn(
                  "mt-2 text-2xl font-bold tabular-nums",
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
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium leading-snug">
                  <span className="text-muted-foreground mr-1.5">Q{i + 1}.</span>
                  {result.question}
                </p>
                {result.passed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    PASS
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-red-500">
                    <XCircle className="h-3.5 w-3.5" />
                    FAIL
                  </span>
                )}
              </div>

              <div className="space-y-3 px-4 py-3 text-sm">
                {/* Ground truth */}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ground Truth
                  </p>
                  <p className="text-foreground/80 leading-relaxed">{result.ground_truth}</p>
                </div>

                {/* Generated answer */}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Generated Answer
                  </p>
                  <p className="text-foreground/80 leading-relaxed">{result.generated_answer}</p>
                </div>

                {/* Failure reason */}
                {result.failure_reason && (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    <p className="text-xs font-semibold text-red-600 mb-0.5">Failure Reason</p>
                    <p className="text-xs text-red-700">{result.failure_reason}</p>
                  </div>
                )}

                {/* Retrieved chunks */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Retrieved Chunks ({result.retrieved_chunks?.length ?? 0})
                  </p>
                  {result.retrieved_chunks?.length > 0 ? (
                    <div className="space-y-1">
                      {result.retrieved_chunks.map((chunk, j) => (
                        <SourceCard key={j} source={chunk} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">No chunks retrieved.</p>
                  )}
                </div>

                {/* Metric pills */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                  {Object.entries(result.metrics).map(([key, value]) => (
                    <MetricPill key={key} name={key} value={value} />
                  ))}
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">
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
