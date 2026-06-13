"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Scissors, Search, Cpu, Database, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PipelineConfigResponse, PipelineConfigUpdateRequest } from "@/lib/types";

const LLM_MODELS: Record<string, { label: string; value: string }[]> = {
  openai: [
    { label: "GPT-4o mini", value: "gpt-4o-mini" },
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
  ],
  anthropic: [
    { label: "Claude 3.5 Haiku", value: "claude-haiku-4-5-20251001" },
    { label: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" },
  ],
  gemini: [
    { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
    { label: "Gemini 2.0 Flash Lite", value: "gemini-2.0-flash-lite" },
    { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
  ],
  ollama: [
    { label: "Llama 3", value: "llama3" },
    { label: "Mistral", value: "mistral" },
  ],
};

const EMBEDDING_MODELS: Record<
  string,
  { label: string; value: string; dim: number }[]
> = {
  openai: [
    { label: "text-embedding-3-small (1536d)", value: "text-embedding-3-small", dim: 1536 },
    { label: "text-embedding-3-large (3072d)", value: "text-embedding-3-large", dim: 3072 },
  ],
  gemini: [
    { label: "gemini-embedding-001 (768d)", value: "gemini-embedding-001", dim: 768 },
  ],
  local: [
    { label: "BAAI/bge-small-en-v1.5 (384d)", value: "BAAI/bge-small-en-v1.5", dim: 384 },
    { label: "all-MiniLM-L6-v2 (384d)", value: "all-MiniLM-L6-v2", dim: 384 },
  ],
};

function detectLLMProvider(model: string): string {
  if (model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3")) return "openai";
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "gemini";
  return "ollama";
}

function getDimension(provider: string, model: string): number | null {
  const opts = EMBEDDING_MODELS[provider] ?? [];
  return opts.find((o) => o.value === model)?.dim ?? null;
}

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
  );
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [config, setConfig] = useState<PipelineConfigResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [polling, setPolling] = useState(false);
  const [applied, setApplied] = useState(false);
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [strategy, setStrategy] = useState("");
  const [chunkSize, setChunkSize] = useState(0);
  const [overlap, setOverlap] = useState(0);

  const [mode, setMode] = useState("");
  const [topK, setTopK] = useState(0);
  const [reranker, setReranker] = useState(false);

  const [llmProvider, setLlmProvider] = useState("gemini");
  const [llmModel, setLlmModel] = useState("");

  const [embProvider, setEmbProvider] = useState("");
  const [embModel, setEmbModel] = useState("");

  const loadConfig = useCallback(async () => {
    const cfg = await api.get<PipelineConfigResponse>("/api/config/");
    setConfig(cfg);
    setStrategy(cfg.chunking.strategy);
    setChunkSize(cfg.chunking.chunk_size);
    setOverlap(cfg.chunking.overlap);
    setMode(cfg.retrieval.mode);
    setTopK(cfg.retrieval.top_k);
    setReranker(cfg.retrieval.reranker_enabled);
    const provider = detectLLMProvider(cfg.generation.model);
    setLlmProvider(provider);
    setLlmModel(cfg.generation.model);
    setEmbProvider(cfg.embedding.provider);
    setEmbModel(cfg.embedding.model);
  }, []);

  useEffect(() => {
    if (open) loadConfig();
  }, [open, loadConfig]);

  const handleLlmProviderChange = (provider: string | null) => {
    if (!provider) return;
    setLlmProvider(provider);
    const firstModel = LLM_MODELS[provider]?.[0]?.value ?? "";
    setLlmModel(firstModel);
  };

  const handleEmbProviderChange = (provider: string | null) => {
    if (!provider) return;
    setEmbProvider(provider);
    const firstModel = EMBEDDING_MODELS[provider]?.[0]?.value ?? "";
    setEmbModel(firstModel);
  };

  const runSuccessAnimation = useCallback(() => {
    // Clear any pending animation timers from a previous apply
    animTimers.current.forEach(clearTimeout);
    animTimers.current = [];

    // green "Applied!" → 800ms → close
    setApplied(true);
    setSaving(false);
    const t1 = setTimeout(() => {
      onOpenChange(false);
      const t2 = setTimeout(() => setApplied(false), 200);
      animTimers.current.push(t2);
    }, 800);
    animTimers.current.push(t1);
  }, [onOpenChange]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const cfg = await api.get<PipelineConfigResponse>("/api/config/");
      if (!cfg.status.reindexing) {
        setPolling(false);
        setConfig(cfg);
        runSuccessAnimation();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, runSuccessAnimation]);

  const handleApply = async () => {
    if (!config) return;
    // Clear any leftover timers from a previous apply before starting fresh
    animTimers.current.forEach(clearTimeout);
    animTimers.current = [];
    setApplied(false);
    setSaving(true);
    const update: PipelineConfigUpdateRequest = {};

    if (
      strategy !== config.chunking.strategy ||
      chunkSize !== config.chunking.chunk_size ||
      overlap !== config.chunking.overlap
    ) {
      update.chunking = { strategy, chunk_size: chunkSize, overlap };
    }
    if (
      mode !== config.retrieval.mode ||
      topK !== config.retrieval.top_k ||
      reranker !== config.retrieval.reranker_enabled
    ) {
      update.retrieval = { mode, top_k: topK, reranker_enabled: reranker };
    }
    if (llmModel !== config.generation.model) {
      update.generation = { model: llmModel };
    }
    if (embProvider !== config.embedding.provider || embModel !== config.embedding.model) {
      update.embedding = { provider: embProvider, model: embModel };
    }

    const [result] = await Promise.all([
      api.put<PipelineConfigResponse>("/api/config/", update),
      new Promise((res) => setTimeout(res, 1200)),
    ]);
    setConfig(result as PipelineConfigResponse);

    if ((result as PipelineConfigResponse).status.reindexing) {
      setSaving(false);
      setPolling(true);
    } else {
      runSuccessAnimation();
    }
  };

  const activeDim = getDimension(embProvider, embModel);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[440px]">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-base font-semibold">Pipeline Settings</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Changes trigger a re-index of all documents.
          </p>
        </SheetHeader>

        {!config ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 px-6 py-5">

            {/* Chunking */}
            <section className="space-y-3">
              <SectionHeader icon={Scissors} title="Chunking" />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Strategy</label>
                <Select value={strategy} onValueChange={(v) => v && setStrategy(v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recursive">Recursive</SelectItem>
                    <SelectItem value="fixed">Fixed size</SelectItem>
                    <SelectItem value="semantic">Semantic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Chunk size</label>
                  <Input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Overlap</label>
                  <Input
                    type="number"
                    value={overlap}
                    onChange={(e) => setOverlap(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Retrieval */}
            <section className="space-y-3">
              <SectionHeader icon={Search} title="Retrieval" />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Mode</label>
                <Select value={mode} onValueChange={(v) => v && setMode(v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hybrid">Hybrid (Dense + BM25)</SelectItem>
                    <SelectItem value="dense">Dense only</SelectItem>
                    <SelectItem value="sparse">Sparse (BM25) only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Top K results</label>
                <Input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="h-9"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50">
                <input
                  type="checkbox"
                  id="reranker"
                  checked={reranker}
                  onChange={(e) => setReranker(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-sm font-medium">Cross-encoder reranker</span>
              </label>
            </section>

            <Separator />

            {/* Generation */}
            <section className="space-y-3">
              <SectionHeader icon={Cpu} title="Generation (LLM)" />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Provider</label>
                <Select value={llmProvider} onValueChange={handleLlmProviderChange}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="ollama">Ollama (local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Model</label>
                {llmProvider === "ollama" ? (
                  <Input
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="e.g. llama3, mistral"
                    className="h-9"
                  />
                ) : (
                  <Select value={llmModel} onValueChange={(v) => v && setLlmModel(v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(LLM_MODELS[llmProvider] ?? []).map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </section>

            <Separator />

            {/* Embedding */}
            <section className="space-y-3">
              <SectionHeader icon={Database} title="Embedding" />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Provider</label>
                <Select value={embProvider} onValueChange={handleEmbProviderChange}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="local">Local (sentence-transformers)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground/80">Model</label>
                  {activeDim && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {activeDim}d
                    </Badge>
                  )}
                </div>
                <Select value={embModel} onValueChange={(v) => v && setEmbModel(v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(EMBEDDING_MODELS[embProvider] ?? []).map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <Separator />

            {/* Status */}
            {(polling || config.status.active_collection) && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs">
                {polling ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Re-indexing documents…</span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      <span>Active collection</span>
                    </div>
                    <p className="font-mono text-[11px] text-foreground/70 pl-5">
                      {config.status.active_collection}
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleApply}
              disabled={saving || polling || applied}
              size="sm"
              className="w-full transition-all duration-300"
              style={applied ? { backgroundColor: "#16a34a", color: "white" } : undefined}
            >
              {applied ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Applied!</>
              ) : saving || polling ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{polling ? "Re-indexing…" : "Applying…"}</>
              ) : (
                "Apply Changes"
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
