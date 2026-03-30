"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatScore } from "@/lib/utils";
import type { EvalRunResponse } from "@/lib/types";
import { SourceCard } from "@/components/chat/source-card";

interface ResultDetailProps {
  run: EvalRunResponse;
  onBack: () => void;
}

export function ResultDetail({ run, onBack }: ResultDetailProps) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to history
      </button>

      {/* Summary metrics */}
      {run.metrics && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(run.metrics).map(([key, value]) => (
            <Card key={key}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="text-xl font-bold">{formatScore(value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Per-question results */}
      <h3 className="text-lg font-semibold">
        Results ({run.pass_count ?? 0}/{run.question_count ?? 0} passed)
      </h3>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {run.results?.map((result, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Q{i + 1}: {result.question}</CardTitle>
                  <Badge variant={result.passed ? "default" : "destructive"}>
                    {result.passed ? "PASS" : "FAIL"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Ground Truth
                  </p>
                  <p>{result.ground_truth}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Generated Answer
                  </p>
                  <p>{result.generated_answer}</p>
                </div>
                {result.failure_reason && (
                  <div>
                    <p className="text-xs font-medium text-destructive">
                      Failure Reason
                    </p>
                    <p className="text-destructive">{result.failure_reason}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Retrieved Chunks ({result.retrieved_chunks?.length ?? 0})
                  </p>
                  {result.retrieved_chunks?.length > 0 ? (
                    <div className="space-y-1">
                      {result.retrieved_chunks.map((chunk, j) => (
                        <SourceCard key={j} source={chunk} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No chunks were retrieved for this question.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {Object.entries(result.metrics).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}: {formatScore(value)}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">
                    {result.latency_ms}ms
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
