"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import type { DatasetSummaryResponse, DocumentResponse, EvalRunResponse, PipelineConfigResponse } from "@/lib/types";
import { useEvalContext } from "@/context/eval-context";
import { useProjectContext } from "@/context/project-context";
import { RunHistory } from "@/components/evaluate/run-history";
import { ResultDetail } from "@/components/evaluate/result-detail";
import { ProgressBar } from "@/components/evaluate/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Play, Database, XCircle, FolderKanban, FileText, Info, CheckCircle2, AlertTriangle, Cpu,
} from "lucide-react";
import { UploadDataset } from "@/components/evaluate/upload-dataset";

function defaultRunName(cfg: PipelineConfigResponse): string {
  const strategy = cfg.chunking.strategy;
  const mode = cfg.retrieval.mode;
  const rerank = cfg.retrieval.reranker_enabled ? "+rerank" : "";
  const d = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${strategy}/${mode}${rerank} (${d})`;
}

const METRIC_EXPLANATIONS: Record<string, string> = {
  faithfulness: "Answer only uses facts from retrieved context",
  answer_relevancy: "Answer directly addresses the question",
  contextual_precision: "Retrieved chunks are ranked correctly",
  contextual_recall: "Ground truth is covered by retrieved chunks",
  contextual_relevancy: "Retrieved chunks are relevant to the question",
};

export default function EvaluatePage() {
  const { activeRun, setActiveRun } = useEvalContext();
  const { activeProject } = useProjectContext();
  const [datasets, setDatasets] = useState<DatasetSummaryResponse[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [runs, setRuns] = useState<EvalRunResponse[]>([]);
  const [viewingRun, setViewingRun] = useState<EvalRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [scoringAvailable, setScoringAvailable] = useState<boolean | null>(null);
  const [runName, setRunName] = useState("");
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfigResponse | null>(null);
  const [projectDocs, setProjectDocs] = useState<DocumentResponse[]>([]);
  const [showExplainer, setShowExplainer] = useState(true);

  const loadRuns = useCallback(async () => {
    if (!activeProject) return [];
    const allRuns = await api.get<EvalRunResponse[]>(`/api/eval/runs?project_id=${activeProject.id}`);
    setRuns(allRuns);
    return allRuns;
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setDatasets([]); setRuns([]); setProjectDocs([]);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get<DatasetSummaryResponse[]>(`/api/datasets/?project_id=${activeProject.id}`),
      loadRuns(),
      api.get<DocumentResponse[]>(`/api/documents/?project_id=${activeProject.id}`),
    ])
      .then(([ds, , docs]) => {
        setDatasets(ds);
        if (ds.length > 0) setSelectedDataset(ds[0].id);
        setProjectDocs(docs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get<PipelineConfigResponse>("/api/config/").then((cfg) => {
      setScoringAvailable(cfg.status.scoring_available);
      setPipelineConfig(cfg);
      setRunName(defaultRunName(cfg));
    }).catch(() => {});
  }, [loadRuns, activeProject]);

  useEffect(() => {
    if (activeRun && activeRun.status !== "running") loadRuns();
  }, [activeRun?.status, loadRuns]);

  const startRun = async () => {
    if (!selectedDataset || !activeProject) return;
    setStarting(true); setStartError(null);
    try {
      const run = await api.post<EvalRunResponse>("/api/eval/run", {
        dataset_id: selectedDataset,
        name: runName.trim() || undefined,
        project_id: activeProject.id,
      });
      setActiveRun(run);
      setRuns((prev) => [run, ...prev]);
      if (pipelineConfig) setRunName(defaultRunName(pipelineConfig));
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleViewRun = async (run: EvalRunResponse) => {
    const full = await api.get<EvalRunResponse>(`/api/eval/runs/${run.id}`);
    setViewingRun(full);
  };

  const handleDeleteRun = async (run: EvalRunResponse) => {
    if (!confirm(`Delete eval run "${run.name || run.id.slice(0, 8)}"?`)) return;
    try {
      const res = await api.del(`/api/eval/runs/${run.id}`);
      if (res.ok || res.status === 204) {
        setRuns((prev) => prev.filter((r) => r.id !== run.id));
        if (activeRun?.id === run.id) setActiveRun(null);
      }
    } catch {}
  };

  // No project guard
  if (!activeProject) {
    return (
      <div className="space-y-7">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="pb-5" style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-2" style={{ background: "#F4C542" }} />
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">Evaluate</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select a project to continue</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-4 py-24"
          style={{ border: "3px dashed oklch(0.10 0.01 240)" }}>
          <div className="flex h-16 w-16 items-center justify-center"
            style={{ background: "#F4C542", border: "3px solid oklch(0.10 0.01 240)" }}>
            <FolderKanban className="h-8 w-8 text-black" />
          </div>
          <p className="text-base font-black uppercase tracking-widest">No Project Selected</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Select or create a project from the top-right to run evaluations.
          </p>
        </motion.div>
      </div>
    );
  }

  if (viewingRun) {
    return (
      <div className="space-y-7">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="pb-5" style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-2" style={{ background: "#E63946" }} />
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">Eval Results</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Per-question breakdown & retrieved context</p>
            </div>
          </div>
        </motion.div>
        <ResultDetail run={viewingRun} onBack={() => setViewingRun(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }} className="pb-5"
        style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-2" style={{ background: "#F4C542" }} />
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">Evaluate</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Project: {activeProject.name}
            </p>
          </div>
        </div>
      </motion.div>

      {/* How it works — collapsible explainer */}
      {showExplainer && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="relative px-4 py-3 text-xs"
          style={{ background: "oklch(0.97 0.004 80)", border: "2px solid oklch(0.10 0.01 240)", boxShadow: "4px 4px 0 #2563EB" }}>
          <button onClick={() => setShowExplainer(false)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss">
            ✕
          </button>
          <div className="flex items-start gap-2 mb-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
            <p className="font-black uppercase tracking-widest text-foreground">How Evaluation Works</p>
          </div>
          <ol className="space-y-1 pl-5 text-muted-foreground list-decimal">
            <li>Upload a <strong>Q&A dataset</strong> (JSON with <code className="bg-black/10 px-1 rounded">question</code> + <code className="bg-black/10 px-1 rounded">ground_truth</code> pairs).</li>
            <li>Click <strong>Run Evaluation</strong> — each question is sent through your RAG pipeline against <strong>all {projectDocs.length} document{projectDocs.length !== 1 ? "s" : ""}</strong> in this project.</li>
            <li>Answers are scored on <strong>5 RAG metrics</strong>: Faithfulness, Answer Relevancy, Contextual Precision, Recall, and Relevancy.</li>
            <li>Results are saved so you can compare pipeline configs across runs.</li>
          </ol>
          <div className="mt-2 flex flex-wrap gap-2 pt-2" style={{ borderTop: "1px solid oklch(0.88 0.01 240)" }}>
            {Object.entries(METRIC_EXPLANATIONS).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                <strong className="capitalize">{k.replace(/_/g, " ")}:</strong> {v}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Doc count */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
          style={{ background: "#2563EB", color: "white", border: "2px solid oklch(0.10 0.01 240)" }}>
          <FileText className="h-3 w-3" />
          {projectDocs.length} doc{projectDocs.length !== 1 ? "s" : ""} in project
        </div>
        {/* Scoring mode */}
        {scoringAvailable !== null && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold`}
            style={{
              background: scoringAvailable ? "#16a34a" : "#F4C542",
              color: scoringAvailable ? "white" : "black",
              border: "2px solid oklch(0.10 0.01 240)",
            }}>
            {scoringAvailable
              ? <><CheckCircle2 className="h-3 w-3" /> LLM Scoring (DeepEval)</>
              : <><AlertTriangle className="h-3 w-3" /> Heuristic Scoring — add API key for LLM scoring</>}
          </div>
        )}
        {/* Active model */}
        {pipelineConfig && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
            style={{ background: "white", border: "2px solid oklch(0.10 0.01 240)" }}>
            <Cpu className="h-3 w-3" />
            {pipelineConfig.generation.model}
          </div>
        )}
      </div>

      {/* Run card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} className="p-5"
        style={{ background: "white", border: "3px solid oklch(0.10 0.01 240)", boxShadow: "8px 8px 0 #F4C542" }}>
        <div className="flex items-center gap-2 pb-4 mb-4" style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}>
          <div className="h-5 w-1.5" style={{ background: "#F4C542" }} />
          <h2 className="text-sm font-black uppercase tracking-widest">Run Configuration</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Run Name</label>
            <Input value={runName} onChange={(e) => setRunName(e.target.value)}
              placeholder="e.g. Hybrid baseline" className="h-9 w-56"
              style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" /> Dataset
            </label>
            {loading ? (
              <div className="h-9 w-64 animate-pulse rounded" style={{ background: "oklch(0.93 0.01 240)" }} />
            ) : datasets.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No datasets yet — upload one →</p>
            ) : (
              <Select value={selectedDataset} onValueChange={(v) => v && setSelectedDataset(v)}>
                <SelectTrigger className="h-9 w-64" style={{ border: "2px solid oklch(0.10 0.01 240)", borderRadius: 0 }}>
                  <SelectValue placeholder="Select dataset">
                    {datasets.find((ds) => ds.id === selectedDataset)?.name ?? "Select dataset"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name}
                      <span className="ml-1.5 text-muted-foreground">({ds.item_count} Q&As)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <motion.button onClick={startRun}
            disabled={!selectedDataset || starting || activeRun?.status === "running" || projectDocs.length === 0}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            className="inline-flex h-9 items-center gap-2 px-5 text-sm font-black uppercase tracking-wider text-white disabled:opacity-50"
            style={{ background: "#E63946", border: "2px solid oklch(0.10 0.01 240)", boxShadow: "4px 4px 0 oklch(0.10 0.01 240)", borderRadius: 0 }}>
            {starting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                className="h-3.5 w-3.5 border-2 border-white" style={{ borderRadius: 0, borderTopColor: "transparent" }} />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run Evaluation
          </motion.button>
          <UploadDataset
            onUploaded={(ds) => { setDatasets((prev) => [...prev, ds]); setSelectedDataset(ds.id); }}
            projectId={activeProject.id}
          />
        </div>

        {/* Scope note */}
        {projectDocs.length === 0 && (
          <p className="mt-3 text-xs text-amber-700 font-medium">
            ⚠ No documents in this project — upload documents first before running evaluation.
          </p>
        )}

        {/* Active run progress */}
        {activeRun?.status === "running" && activeRun.progress && (
          <div className="mt-5 p-3 space-y-2"
            style={{ background: "#F4C542", border: "2px solid oklch(0.10 0.01 240)" }}>
            <p className="text-xs font-black uppercase tracking-widest text-black">
              Evaluating question {activeRun.progress.completed + 1} of {activeRun.progress.total}…
            </p>
            <ProgressBar completed={activeRun.progress.completed} total={activeRun.progress.total} />
          </div>
        )}
      </motion.div>

      {/* Error */}
      {startError && (
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-start gap-3 px-4 py-3"
          style={{ background: "#E63946", border: "3px solid oklch(0.10 0.01 240)", boxShadow: "4px 4px 0 oklch(0.10 0.01 240)" }}>
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-white" />
          <p className="text-sm font-bold text-white">
            <span className="font-black uppercase tracking-wider">Failed:</span> {startError}
          </p>
        </motion.div>
      )}

      {/* Run history */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-2" style={{ background: "#2563EB" }} />
          <h2 className="text-lg font-black uppercase tracking-widest text-foreground">History</h2>
          {runs.length > 0 && (
            <span className="text-xs font-bold text-muted-foreground">{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <RunHistory runs={runs} onViewRun={handleViewRun} onDeleteRun={handleDeleteRun} />
      </motion.div>
    </div>
  );
}
