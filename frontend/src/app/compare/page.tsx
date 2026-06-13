"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EvalRunResponse, EvalCompareResponse } from "@/lib/types";
import { runLabel, formatScore, formatDelta } from "@/lib/utils";
import { RadarChart } from "@/components/dashboard/radar-chart";
import { InsightCard } from "@/components/dashboard/insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ComparePage() {
  const [runs, setRuns] = useState<EvalRunResponse[]>([]);
  const [runAId, setRunAId] = useState<string>("");
  const [runBId, setRunBId] = useState<string>("");
  const [comparison, setComparison] = useState<EvalCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<EvalRunResponse[]>("/api/eval/runs")
      .then((allRuns) => {
        const completed = allRuns.filter((r) => r.status === "completed");
        setRuns(completed);
        if (completed.length >= 2) {
          setRunAId(completed[completed.length - 2].id);
          setRunBId(completed[completed.length - 1].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!runAId || !runBId || runAId === runBId) {
      setComparison(null);
      return;
    }
    setLoading(true);
    api
      .get<EvalCompareResponse>(`/api/eval/compare?run_a=${runAId}&run_b=${runBId}`)
      .then(setComparison)
      .catch(() => setComparison(null))
      .finally(() => setLoading(false));
  }, [runAId, runBId]);

  const runA = runs.find((r) => r.id === runAId);
  const runB = runs.find((r) => r.id === runBId);
  const labelA = runA ? runLabel(runA) : "Run A";
  const labelB = runB ? runLabel(runB) : "Run B";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compare Runs</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Side-by-side metric and configuration diff between two eval runs.
        </p>
      </div>

      {/* Run selectors */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Baseline (Run A)</label>
              <Select value={runAId} onValueChange={(v) => v && setRunAId(v)}>
                <SelectTrigger className="h-9 w-60">
                  <SelectValue placeholder="Select run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {runLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-0.5">
              <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Experiment (Run B)</label>
              <Select value={runBId} onValueChange={(v) => v && setRunBId(v)}>
                <SelectTrigger className="h-9 w-60">
                  <SelectValue placeholder="Select run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {runLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {comparison && (
        <div className="space-y-5">
          {/* Radar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Metric Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <RadarChart
                metricsA={(comparison.run_a.metrics ?? {}) as Record<string, number>}
                metricsB={(comparison.run_b.metrics ?? {}) as Record<string, number>}
                labelA={labelA}
                labelB={labelB}
              />
            </CardContent>
          </Card>

          {/* Metric deltas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Metric Deltas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Metric</TableHead>
                    <TableHead>{labelA}</TableHead>
                    <TableHead>{labelB}</TableHead>
                    <TableHead>Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(comparison.deltas).map(([key, delta]) => {
                    const metricsA = comparison.run_a.metrics as Record<string, number> | undefined;
                    const metricsB = comparison.run_b.metrics as Record<string, number> | undefined;
                    return (
                      <TableRow key={key}>
                        <TableCell className="pl-6 font-medium">
                          {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {metricsA?.[key] != null ? formatScore(metricsA[key]) : "-"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {metricsB?.[key] != null ? formatScore(metricsB[key]) : "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "tabular-nums font-medium",
                            delta > 0 ? "text-green-600" : delta < 0 ? "text-red-500" : "text-muted-foreground"
                          )}
                        >
                          {formatDelta(delta)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Config diff */}
          {comparison.config_diff.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Configuration Differences</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Setting</TableHead>
                      <TableHead>{labelA}</TableHead>
                      <TableHead>{labelB}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.config_diff.map((diff, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6 font-medium">
                          {String(diff.field)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {String(diff.value_a)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-foreground">
                          {String(diff.value_b)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Insights */}
          {comparison.insights.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Insights</h2>
              {comparison.insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !comparison && runAId && runBId && runAId !== runBId && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Failed to load comparison.
        </p>
      )}

      {runs.length < 2 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <GitCompareArrows className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Complete at least 2 evaluation runs to compare them here.
          </p>
          <a
            href="/evaluate"
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to Evaluate →
          </a>
        </div>
      )}
    </div>
  );
}
