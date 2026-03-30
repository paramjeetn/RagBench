"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { DatasetSummaryResponse, EvalRunResponse } from "@/lib/types";
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
import { Loader2, Play } from "lucide-react";
import { UploadDataset } from "@/components/evaluate/upload-dataset";

export default function EvaluatePage() {
  const { activeRun, setActiveRun } = useEvalContext();
  const [datasets, setDatasets] = useState<DatasetSummaryResponse[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [runs, setRuns] = useState<EvalRunResponse[]>([]);
  const [viewingRun, setViewingRun] = useState<EvalRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

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
  }, [loadRuns]);

  // Refresh run history when active run completes
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (viewingRun) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Evaluation Results</h1>
        <ResultDetail run={viewingRun} onBack={() => setViewingRun(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Evaluate</h1>

      {/* Start new run */}
      <div className="flex items-end gap-3">
        <div className="w-64 space-y-1">
          <label className="text-xs text-muted-foreground">Dataset</label>
          <Select value={selectedDataset} onValueChange={(v) => v && setSelectedDataset(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select dataset" />
            </SelectTrigger>
            <SelectContent>
              {datasets.map((ds) => (
                <SelectItem key={ds.id} value={ds.id}>
                  {ds.name} ({ds.item_count} items)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={startRun}
          disabled={!selectedDataset || starting || activeRun?.status === "running"}
        >
          {starting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
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
        <ProgressBar
          completed={activeRun.progress.completed}
          total={activeRun.progress.total}
        />
      )}

      {/* Run history */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        <RunHistory runs={runs} onViewRun={handleViewRun} />
      </div>
    </div>
  );
}
