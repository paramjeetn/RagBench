"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { runLabel } from "@/lib/utils";
import type { EvalRunResponse, EvalCompareResponse } from "@/lib/types";
import { RadarChart } from "@/components/dashboard/radar-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FlaskConical } from "lucide-react";

export default function DashboardPage() {
  const [comparison, setComparison] = useState<EvalCompareResponse | null>(null);
  const [runs, setRuns] = useState<EvalRunResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const allRuns = await api.get<EvalRunResponse[]>("/api/eval/runs");
        const completed = allRuns.filter((r) => r.status === "completed");
        setRuns(completed);

        if (completed.length >= 2) {
          const a = completed[completed.length - 2];
          const b = completed[completed.length - 1];
          const cmp = await api.get<EvalCompareResponse>(
            `/api/eval/compare?run_a=${a.id}&run_b=${b.id}`
          );
          setComparison(cmp);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">Failed to load dashboard: {error}</p>
        <p className="text-xs">Make sure the backend is running on port 8000.</p>
      </div>
    );
  }

  if (!comparison || runs.length < 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <FlaskConical className="h-12 w-12" />
        <div className="text-center">
          <p className="text-lg font-medium">Welcome to RAG Eval System</p>
          <p className="text-sm">
            Run at least 2 evaluations to see comparison metrics here.
          </p>
          <p className="mt-1 text-xs">
            {runs.length} completed run{runs.length !== 1 ? "s" : ""} so far.
          </p>
        </div>
      </div>
    );
  }

  const runA = runs[runs.length - 2];
  const runB = runs[runs.length - 1];
  const labelA = runLabel(runA);
  const labelB = runLabel(runB);
  const metricsA = (comparison.run_a.metrics ?? {}) as Record<string, number>;
  const metricsB = (comparison.run_b.metrics ?? {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Comparing {labelA} vs {labelB}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Object.entries(metricsB).map(([key, value]) => (
          <MetricCard
            key={key}
            name={key}
            value={value}
            delta={comparison.deltas[key] ?? 0}
          />
        ))}
      </div>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Metric Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <RadarChart
            metricsA={metricsA}
            metricsB={metricsB}
            labelA={labelA}
            labelB={labelB}
          />
        </CardContent>
      </Card>

      {/* Insights */}
      {comparison.insights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Insights</h2>
          {comparison.insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
