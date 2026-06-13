"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { DatasetSummaryResponse, EvalRunResponse, PipelineConfigResponse } from "@/lib/types";
import { useEvalContext } from "@/context/eval-context";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Play, Database, TriangleAlert, XCircle } from "lucide-react";
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
    const allRuns = await api.get<EvalRunResponse[]>("/api/eval/runs");
    setRuns(allRuns);
    return allRuns;
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<DatasetSummaryResponse[]>("/api/datasets/"),
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
  }, [loadRuns]);

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
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (viewingRun) {
    return (
      <div className="space-y-7">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Evaluation Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-question breakdown and retrieved context.
          </p>
        </div>
        <ResultDetail run={viewingRun} onBack={() => setViewingRun(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Evaluate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Run RAG Triad evaluation against a Q&amp;A dataset.
        </p>
      </div>

      {/* Run controls */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Run name</label>
              <Input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="e.g. Hybrid baseline"
                className="h-9 w-56"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3" />
                Dataset
              </label>
              <Select value={selectedDataset} onValueChange={(v) => v && setSelectedDataset(v)}>
                <SelectTrigger className="h-9 w-64">
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
            <Button
              onClick={startRun}
              disabled={!selectedDataset || starting || activeRun?.status === "running"}
              size="sm"
              className="h-9 gap-2"
            >
              {starting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Run Evaluation
            </Button>
            <UploadDataset
              onUploaded={(ds) => {
                setDatasets((prev) => [...prev, ds]);
                setSelectedDataset(ds.id);
              }}
            />
          </div>

          {/* Active run progress */}
          {activeRun?.status === "running" && activeRun.progress && (
            <div className="mt-4 border-t pt-4">
              <ProgressBar
                completed={activeRun.progress.completed}
                total={activeRun.progress.total}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start error */}
      {startError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p><span className="font-semibold">Failed to start evaluation:</span> {startError}</p>
        </div>
      )}

      {/* Scoring mode warning */}
      {scoringAvailable === false && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>
            <span className="font-semibold">No API key detected</span> — runs will use heuristic scoring.
            Add <code className="rounded bg-amber-100 px-1 font-mono text-xs">OPENAI_API_KEY</code>,{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs">ANTHROPIC_API_KEY</code>, or{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs">GEMINI_API_KEY</code> for LLM-based eval.
          </p>
        </div>
      )}

      {/* Run history */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">History</h2>
        <RunHistory runs={runs} onViewRun={handleViewRun} />
      </div>
    </div>
  );
}
