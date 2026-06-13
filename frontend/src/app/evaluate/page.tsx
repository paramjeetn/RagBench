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
import { Loader2, Play, Database, TriangleAlert } from "lucide-react";
import { UploadDataset } from "@/components/evaluate/upload-dataset";

export default function EvaluatePage() {
  const { activeRun, setActiveRun } = useEvalContext();
  const [datasets, setDatasets] = useState<DatasetSummaryResponse[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [runs, setRuns] = useState<EvalRunResponse[]>([]);
  const [viewingRun, setViewingRun] = useState<EvalRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [scoringAvailable, setScoringAvailable] = useState<boolean | null>(null);

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
      .then((cfg) => setScoringAvailable(cfg.status.scoring_available))
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
    try {
      const run = await api.post<EvalRunResponse>("/api/eval/run", {
        dataset_id: selectedDataset,
      });
      setActiveRun(run);
      setRuns((prev) => [run, ...prev]);
    } catch (err) {
      console.error("Failed to start eval:", err);
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
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3" />
                Dataset
              </label>
              <Select value={selectedDataset} onValueChange={(v) => v && setSelectedDataset(v)}>
                <SelectTrigger className="h-9 w-64">
                  <SelectValue placeholder="Select dataset" />
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
