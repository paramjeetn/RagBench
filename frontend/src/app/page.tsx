"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { runLabel } from "@/lib/utils";
import type { EvalRunResponse, EvalCompareResponse } from "@/lib/types";
import { RadarChart } from "@/components/dashboard/radar-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FlaskConical, ArrowRight } from "lucide-react";

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
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm font-medium">Failed to load dashboard</p>
        <p className="text-xs">{error}</p>
        <p className="text-xs">Make sure the backend is running on port 8000.</p>
      </div>
    );
  }

  if (!comparison || runs.length < 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <FlaskConical className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold tracking-tight">Welcome to RagBench</p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Run at least 2 evaluations to see a metric comparison and radar chart here.
          </p>
          {runs.length === 1 && (
            <p className="mt-1 text-xs text-primary font-medium">
              1 run completed — 1 more to go.
            </p>
          )}
        </div>
        <a
          href="/evaluate"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          Go to Evaluate
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
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
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{labelA}</span>
          <ArrowRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{labelB}</span>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Metric Comparison</CardTitle>
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
          <h2 className="text-base font-semibold">Insights</h2>
          {comparison.insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
