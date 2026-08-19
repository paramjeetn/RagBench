"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import type { DatasetSummaryResponse, EvalRunResponse, PipelineConfigResponse } from "@/lib/types";
import { useEvalContext } from "@/context/eval-context";
import { useProjectContext } from "@/context/project-context";
import { RunHistory } from "@/components/evaluate/run-history";
import { ResultDetail } from "@/components/evaluate/result-detail";
import { ProgressBar } from "@/components/evaluate/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Play, Database, TriangleAlert, XCircle } from "lucide-react";
import { UploadDataset } from "@/components/evaluate/upload-dataset";

function defaultRunName(cfg: PipelineConfigResponse): string {
  const strategy = cfg.chunking.strategy;
  const mode = cfg.retrieval.mode;
  const rerank = cfg.retrieval.reranker_enabled ? "+rerank" : "";
  const d = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${strategy}/${mode}${rerank} (${d})`;
}

export default function EvaluatePage() {
  const { activeRun, setActiveRun } = useEvalContext();
  const { activeProject } = useProjectContext();
  const [datasets, setDatasets] = useState<DatasetSummaryResponse[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [runs, setRuns] = useState<EvalRunResponse[]>([]);
  const [viewingRun, setViewingRun] = useState<EvalRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [scoringAvailable, setScoringAvailable] = useState<boolean | null>(null);
  const [runName, setRunName] = useState("");
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfigResponse | null>(null);

  const loadRuns = useCallback(async () => {
    const url = activeProject
      ? `/api/eval/runs?project_id=${activeProject.id}`
      : "/api/eval/runs";
    const allRuns = await api.get<EvalRunResponse[]>(url);
    setRuns(allRuns);
    return allRuns;
  }, [activeProject]);

  useEffect(() => {
    const datasetsUrl = activeProject
      ? `/api/datasets/?project_id=${activeProject.id}`
      : "/api/datasets/";
    Promise.all([
      api.get<DatasetSummaryResponse[]>(datasetsUrl),
      loadRuns(),
    ])
      .then(([ds]) => {
        setDatasets(ds);
        if (ds.length > 0) setSelectedDataset(ds[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get<PipelineConfigResponse>("/api/config/")
      .then((cfg) => {
        setScoringAvailable(cfg.status.scoring_available);
        setPipelineConfig(cfg);
        setRunName(defaultRunName(cfg));
      })
      .catch(() => {});
  }, [loadRuns, activeProject]);

  useEffect(() => {
    if (activeRun && activeRun.status !== "running") {
      loadRuns();
    }
  }, [activeRun?.status, loadRuns]);

  const startRun = async () => {
    if (!selectedDataset) return;
    setStarting(true);
    setStartError(null);
    try {
      const run = await api.post<EvalRunResponse>("/api/eval/run", {
        dataset_id: selectedDataset,
        name: runName.trim() || undefined,
        project_id: activeProject?.id ?? undefined,
      });
      setActiveRun(run);
      setRuns((prev) => [run, ...prev]);
      if (pipelineConfig) setRunName(defaultRunName(pipelineConfig));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStartError(msg);
    } finally {
      setStarting(false);
    }
  };

  const handleViewRun = async (run: EvalRunResponse) => {
    const full = await api.get<EvalRunResponse>(`/api/eval/runs/${run.id}`);
    setViewingRun(full);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-12 w-12 border-4"
            style={{ borderColor: "#F4C542", borderRadius: 0 }}
          />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (viewingRun) {
    return (
      <div className="space-y-7">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="pb-5"
          style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-2" style={{ background: "#E63946" }} />
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">
                Eval Results
              </h1>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Per-question breakdown & retrieved context
              </p>
            </div>
          </div>
        </motion.div>
        <ResultDetail run={viewingRun} onBack={() => setViewingRun(null)} />
      </div>
    );
  }

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
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">Evaluate</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Run RAG Triad evaluation on a Q&amp;A dataset
            </p>
          </div>
        </div>
      </motion.div>

      {/* Run controls */}
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
        <div className="flex items-center gap-2 pb-4 mb-4" style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}>
          <div className="h-5 w-1.5" style={{ background: "#F4C542" }} />
          <h2 className="text-sm font-black uppercase tracking-widest">Run Configuration</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Run Name</label>
            <Input
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder="e.g. Hybrid baseline"
              className="h-9 w-56"
              style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              Dataset
            </label>
            <Select value={selectedDataset} onValueChange={(v) => v && setSelectedDataset(v)}>
              <SelectTrigger
                className="h-9 w-64"
                style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }}
              >
                <SelectValue placeholder="Select dataset">
                  {datasets.find((ds) => ds.id === selectedDataset)?.name ?? "Select dataset"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {datasets.map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>
                    {ds.name}
                    <span className="ml-1.5 text-muted-foreground">({ds.item_count} items)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <motion.button
            onClick={startRun}
            disabled={!selectedDataset || starting || activeRun?.status === "running"}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex h-9 items-center gap-2 px-5 text-sm font-black uppercase tracking-wider text-white disabled:opacity-50"
            style={{
              background: "#E63946",
              border: "2px solid oklch(0.10 0.01 240)",
              boxShadow: "4px 4px 0 oklch(0.10 0.01 240)",
              borderRadius: 0,
            }}
          >
            {starting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                className="h-3.5 w-3.5 border-2 border-white"
                style={{ borderRadius: 0, borderTopColor: "transparent" }}
              />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run Evaluation
          </motion.button>
          <UploadDataset
            onUploaded={(ds) => {
              setDatasets((prev) => [...prev, ds]);
              setSelectedDataset(ds.id);
            }}
          />
        </div>

        {/* Active run progress */}
        {activeRun?.status === "running" && activeRun.progress && (
          <div
            className="mt-5 p-3"
            style={{ background: "#F4C542", border: "2px solid oklch(0.10 0.01 240)" }}
          >
            <ProgressBar
              completed={activeRun.progress.completed}
              total={activeRun.progress.total}
            />
          </div>
        )}
      </motion.div>

      {/* Error */}
      {startError && (
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-start gap-3 px-4 py-3"
          style={{
            background: "#E63946",
            border: "3px solid oklch(0.10 0.01 240)",
            boxShadow: "4px 4px 0 oklch(0.10 0.01 240)",
          }}
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-white" />
          <p className="text-sm font-bold text-white">
            <span className="font-black uppercase tracking-wider">Failed:</span> {startError}
          </p>
        </motion.div>
      )}

      {/* Scoring warning */}
      {scoringAvailable === false && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 px-4 py-3"
          style={{
            background: "#F4C542",
            border: "3px solid oklch(0.10 0.01 240)",
            boxShadow: "4px 4px 0 oklch(0.10 0.01 240)",
          }}
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-black" />
          <p className="text-sm font-bold text-black">
            <span className="font-black uppercase tracking-wider">No API Key —</span> runs will use heuristic scoring.
            Add <code className="font-mono text-xs bg-black/10 px-1">OPENAI_API_KEY</code>,{" "}
            <code className="font-mono text-xs bg-black/10 px-1">ANTHROPIC_API_KEY</code>, or{" "}
            <code className="font-mono text-xs bg-black/10 px-1">GEMINI_API_KEY</code> for LLM-based eval.
          </p>
        </motion.div>
      )}

      {/* Run history */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-6 w-2" style={{ background: "#2563EB" }} />
          <h2 className="text-lg font-black uppercase tracking-widest text-foreground">History</h2>
        </div>
        <RunHistory runs={runs} onViewRun={handleViewRun} />
      </motion.div>
    </div>
  );
}
