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
      <div className="flex h-full flex-col items-center justify-center gap-7">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/8 shadow-sm">
          <FlaskConical className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight text-foreground">Welcome to RagBench</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Run at least 2 evaluations to see a metric comparison and radar chart here.
          </p>
          {runs.length === 1 && (
            <p className="mt-2 text-xs text-primary font-semibold">
              1 run completed — 1 more to go.
            </p>
          )}
        </div>
        <a
          href="/evaluate"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
        >
          Go to Evaluate
          <ArrowRight className="h-4 w-4" />
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <span>{labelA}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-foreground">{labelB}</span>
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
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
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-semibold text-foreground">Insights</h2>
          <div className="space-y-3">
            {comparison.insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
