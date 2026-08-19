"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "@/lib/api";
import type { EvalRunResponse, EvalCompareResponse } from "@/lib/types";
import { runLabel, formatScore, formatDelta } from "@/lib/utils";
import { RadarChart } from "@/components/dashboard/radar-chart";
import { InsightCard } from "@/components/dashboard/insight-card";
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
import { GitCompareArrows } from "lucide-react";
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
    <div className="space-y-7">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="pb-5"
        style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-2" style={{ background: "#F4C542" }} />
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">
              Compare Runs
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Side-by-side metric and configuration diff between two eval runs
            </p>
          </div>
        </div>
      </motion.div>

      {/* Run selector card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-5"
        style={{
          background: "white",
          border: "3px solid oklch(0.10 0.01 240)",
          boxShadow: "8px 8px 0 #F4C542",
        }}
      >
        <div
          className="flex items-center gap-2 pb-3 mb-4"
          style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}
        >
          <div className="h-5 w-1.5" style={{ background: "#E63946" }} />
          <h2 className="text-sm font-black uppercase tracking-widest">Select Runs</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Baseline (Run A)
            </label>
            <Select value={runAId} onValueChange={(v) => v && setRunAId(v)}>
              <SelectTrigger
                className="h-9 w-64"
                style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }}
              >
                <SelectValue placeholder="Select run" />
              </SelectTrigger>
              <SelectContent style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }}>
                {runs.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {runLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end pb-0.5">
            <div
              className="flex h-9 w-9 items-center justify-center"
              style={{ background: "oklch(0.10 0.01 240)", color: "white" }}
            >
              <GitCompareArrows className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Experiment (Run B)
            </label>
            <Select value={runBId} onValueChange={(v) => v && setRunBId(v)}>
              <SelectTrigger
                className="h-9 w-64"
                style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }}
              >
                <SelectValue placeholder="Select run" />
              </SelectTrigger>
              <SelectContent style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }}>
                {runs.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {runLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-10 w-10 border-4"
            style={{ borderColor: "#F4C542", borderRadius: 0 }}
          />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Comparing Runs...
          </p>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Radar chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-6"
            style={{
              background: "white",
              border: "3px solid oklch(0.10 0.01 240)",
              boxShadow: "8px 8px 0 #2563EB",
            }}
          >
            <div
              className="flex items-center gap-2 pb-3 mb-4"
              style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}
            >
              <div className="h-5 w-1.5" style={{ background: "#2563EB" }} />
              <h2 className="text-sm font-black uppercase tracking-widest">Metric Comparison</h2>
            </div>
            <RadarChart
              metricsA={(comparison.run_a.metrics ?? {}) as Record<string, number>}
              metricsB={(comparison.run_b.metrics ?? {}) as Record<string, number>}
              labelA={labelA}
              labelB={labelB}
            />
          </motion.div>

          {/* Metric deltas */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="overflow-hidden"
            style={{
              background: "white",
              border: "3px solid oklch(0.10 0.01 240)",
              boxShadow: "8px 8px 0 oklch(0.10 0.01 240)",
            }}
          >
            <div
              className="flex items-center gap-2 p-4"
              style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}
            >
              <div className="h-5 w-1.5" style={{ background: "#F4C542" }} />
              <h2 className="text-sm font-black uppercase tracking-widest">Metric Deltas</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow
                    style={{
                      background: "#F4C542",
                      borderBottom: "3px solid oklch(0.10 0.01 240)",
                    }}
                    className="hover:bg-[#F4C542]"
                  >
                    <TableHead className="pl-6 font-black uppercase tracking-widest text-black">
                      Metric
                    </TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-black">
                      {labelA}
                    </TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-black">
                      {labelB}
                    </TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-black">
                      Delta
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(comparison.deltas).map(([key, delta]) => {
                    const metricsA = comparison.run_a.metrics as
                      | Record<string, number>
                      | undefined;
                    const metricsB = comparison.run_b.metrics as
                      | Record<string, number>
                      | undefined;
                    return (
                      <TableRow
                        key={key}
                        style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}
                        className="hover:bg-amber-50/50"
                      >
                        <TableCell className="pl-6 font-black uppercase tracking-wide text-xs">
                          {key.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold tabular-nums">
                          {metricsA?.[key] != null ? formatScore(metricsA[key]) : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold tabular-nums">
                          {metricsB?.[key] != null ? formatScore(metricsB[key]) : "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "tabular-nums font-mono text-xs font-black",
                            delta > 0
                              ? "text-[#2563EB]"
                              : delta < 0
                              ? "text-[#E63946]"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatDelta(delta)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </motion.div>

          {/* Config diff */}
          {comparison.config_diff.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="overflow-hidden"
              style={{
                background: "white",
                border: "3px solid oklch(0.10 0.01 240)",
                boxShadow: "8px 8px 0 oklch(0.10 0.01 240)",
              }}
            >
              <div
                className="flex items-center gap-2 p-4"
                style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}
              >
                <div className="h-5 w-1.5" style={{ background: "#2563EB" }} />
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Configuration Differences
                </h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow
                      style={{
                        background: "#2563EB",
                        borderBottom: "3px solid oklch(0.10 0.01 240)",
                      }}
                      className="hover:bg-[#2563EB]"
                    >
                      <TableHead className="pl-6 font-black uppercase tracking-widest text-white">
                        Setting
                      </TableHead>
                      <TableHead className="font-black uppercase tracking-widest text-white">
                        {labelA}
                      </TableHead>
                      <TableHead className="font-black uppercase tracking-widest text-white">
                        {labelB}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.config_diff.map((diff, i) => (
                      <TableRow
                        key={i}
                        style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}
                        className="hover:bg-blue-50/50"
                      >
                        <TableCell className="pl-6 font-black uppercase tracking-wide text-xs">
                          {String(diff.field)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                          {String(diff.value_a)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {String(diff.value_b)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          )}

          {/* Insights */}
          {comparison.insights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3 pt-2"
            >
              <div className="flex items-center gap-3">
                <div className="h-6 w-2" style={{ background: "#E63946" }} />
                <h2 className="text-lg font-black uppercase tracking-widest text-foreground">
                  Insights
                </h2>
              </div>
              <div className="space-y-2.5">
                {comparison.insights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Failed to load comparison */}
      {!loading && !comparison && runAId && runBId && runAId !== runBId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
          style={{
            background: "white",
            border: "3px solid oklch(0.10 0.01 240)",
            boxShadow: "6px 6px 0 #E63946",
          }}
        >
          <p className="text-sm font-black uppercase tracking-widest text-[#E63946]">
            Failed to load comparison
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Make sure both selected runs have completed and have metric data.
          </p>
        </motion.div>
      )}

      {/* Empty state: fewer than 2 runs */}
      {runs.length < 2 && (
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{ border: "3px dashed oklch(0.10 0.01 240)" }}
        >
          <div className="relative mb-5">
            <div
              className="h-16 w-16"
              style={{ background: "#2563EB", border: "3px solid oklch(0.10 0.01 240)" }}
            >
              <div
                className="absolute top-2 left-2 h-8 w-8 rounded-full"
                style={{ background: "#F4C542" }}
              />
            </div>
          </div>
          <p className="text-base font-black uppercase tracking-widest text-foreground">
            Insufficient Runs
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Complete at least 2 evaluation runs to compare them here.
          </p>
          <motion.a
            href="/evaluate"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white"
            style={{
              background: "#E63946",
              border: "2px solid oklch(0.10 0.01 240)",
              boxShadow: "4px 4px 0 oklch(0.10 0.01 240)",
              borderRadius: 0,
            }}
          >
            Go to Evaluate →
          </motion.a>
        </div>
      )}
    </div>
  );
}
