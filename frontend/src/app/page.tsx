"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import { runLabel } from "@/lib/utils";
import type { EvalRunResponse, EvalCompareResponse } from "@/lib/types";
import { RadarChart } from "@/components/dashboard/radar-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { Loader2, FlaskConical, ArrowRight, Zap } from "lucide-react";

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
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-12 w-12 border-4 border-bauhaus-yellow"
            style={{ borderRadius: 0 }}
          />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3"
        style={{ color: "#E63946" }}
      >
        <div
          className="px-6 py-4"
          style={{ border: "3px solid #E63946", boxShadow: "6px 6px 0 #E63946" }}
        >
          <p className="text-sm font-black uppercase tracking-wider">Dashboard Error</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!comparison || runs.length < 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8">
        {/* Giant Bauhaus hero shape */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 150, damping: 16 }}
          className="relative"
        >
          {/* Outer yellow square */}
          <div
            className="h-28 w-28 flex items-center justify-center"
            style={{
              background: "#F4C542",
              border: "4px solid oklch(0.10 0.01 240)",
              boxShadow: "8px 8px 0 #E63946",
              borderRadius: 0,
            }}
          >
            {/* Inner red circle */}
            <div
              className="h-16 w-16 flex items-center justify-center"
              style={{ background: "#E63946", borderRadius: "50%" }}
            >
              <FlaskConical className="h-8 w-8 text-white" />
            </div>
          </div>
          {/* Blue triangle accent */}
          <div
            className="absolute -bottom-4 -right-4 h-8 w-8"
            style={{
              background: "#2563EB",
              clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center"
        >
          <p className="text-4xl font-black uppercase tracking-tight text-foreground">
            Welcome to{" "}
            <span style={{ color: "#E63946" }}>RAG</span>
            <span style={{ color: "#2563EB" }}>BENCH</span>
          </p>
          <p className="mt-3 max-w-sm text-sm font-medium text-muted-foreground">
            Run at least 2 evaluations to unlock the comparison dashboard.
          </p>
          {runs.length === 1 && (
            <p className="mt-2 text-xs font-black uppercase tracking-widest" style={{ color: "#F4C542" }}>
              ★ 1 of 2 runs complete
            </p>
          )}
        </motion.div>

        <motion.a
          href="/evaluate"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center gap-3 px-7 py-3.5 text-sm font-black uppercase tracking-widest text-white"
          style={{
            background: "#E63946",
            border: "3px solid oklch(0.10 0.01 240)",
            boxShadow: "6px 6px 0 oklch(0.10 0.01 240)",
            borderRadius: 0,
          }}
        >
          <Zap className="h-4 w-4" />
          Start Evaluating
          <ArrowRight className="h-4 w-4" />
        </motion.a>
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
      {/* Bauhaus Page Header */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-end justify-between"
        style={{ borderBottom: "4px solid oklch(0.10 0.01 240)", paddingBottom: "1rem" }}
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-2 bg-bauhaus-red" />
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">
              Dashboard
            </h1>
          </div>
          <p className="mt-1.5 ml-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span
              className="px-2 py-0.5"
              style={{ background: "#E63946", color: "white", fontSize: "0.6rem" }}
            >
              {labelA}
            </span>
            <ArrowRight className="h-3 w-3" />
            <span
              className="px-2 py-0.5"
              style={{ background: "#2563EB", color: "white", fontSize: "0.6rem" }}
            >
              {labelB}
            </span>
          </p>
        </div>
        {/* Bauhaus decoration — 3 colored dots */}
        <div className="flex gap-2 pb-2">
          <div className="h-5 w-5 rounded-full bg-bauhaus-red" />
          <div className="h-5 w-5 bg-bauhaus-yellow" />
          <div className="h-5 w-5 rounded-full bg-bauhaus-blue" />
        </div>
      </motion.div>

      {/* Metric Cards — bold colorful Bauhaus bento */}
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

      {/* Radar Chart — Bauhaus bordered block */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="p-6"
        style={{
          background: "white",
          border: "3px solid oklch(0.10 0.01 240)",
          boxShadow: "8px 8px 0 oklch(0.10 0.01 240)",
        }}
      >
        <div
          className="flex items-center gap-3 pb-4 mb-4"
          style={{ borderBottom: "3px solid oklch(0.10 0.01 240)" }}
        >
          <div className="h-6 w-2 bg-bauhaus-yellow" />
          <h2 className="text-base font-black uppercase tracking-widest">Metric Comparison</h2>
          <div className="ml-auto flex gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ background: "#E63946" }} />
            <div className="h-3 w-3 rounded-full" style={{ background: "#2563EB" }} />
          </div>
        </div>
        <RadarChart
          metricsA={metricsA}
          metricsB={metricsB}
          labelA={labelA}
          labelB={labelB}
        />
      </motion.div>

      {/* Insights */}
      {comparison.insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-6 w-2 bg-bauhaus-blue" />
            <h2 className="text-lg font-black uppercase tracking-widest text-foreground">Insights</h2>
          </div>
          <div className="space-y-3">
            {comparison.insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} index={i} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}