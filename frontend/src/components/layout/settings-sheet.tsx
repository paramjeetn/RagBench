"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PipelineConfigResponse, PipelineConfigUpdateRequest } from "@/lib/types";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [config, setConfig] = useState<PipelineConfigResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [polling, setPolling] = useState(false);

  // Local form state
  const [strategy, setStrategy] = useState("");
  const [chunkSize, setChunkSize] = useState(0);
  const [overlap, setOverlap] = useState(0);
  const [mode, setMode] = useState("");
  const [topK, setTopK] = useState(0);
  const [reranker, setReranker] = useState(false);
  const [model, setModel] = useState("");
  const [embProvider, setEmbProvider] = useState("");
  const [embModel, setEmbModel] = useState("");
  const [embDim, setEmbDim] = useState(0);

  const loadConfig = useCallback(async () => {
    const cfg = await api.get<PipelineConfigResponse>("/api/config/");
    setConfig(cfg);
    setStrategy(cfg.chunking.strategy);
    setChunkSize(cfg.chunking.chunk_size);
    setOverlap(cfg.chunking.overlap);
    setMode(cfg.retrieval.mode);
    setTopK(cfg.retrieval.top_k);
    setReranker(cfg.retrieval.reranker_enabled);
    setModel(cfg.generation.model);
    setEmbProvider(cfg.embedding.provider);
    setEmbModel(cfg.embedding.model);
    setEmbDim(cfg.embedding.dimension);
  }, []);

  useEffect(() => {
    if (open) loadConfig();
  }, [open, loadConfig]);

  // Poll while reindexing
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const cfg = await api.get<PipelineConfigResponse>("/api/config/");
      if (!cfg.status.reindexing) {
        setPolling(false);
        setConfig(cfg);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling]);

  const handleApply = async () => {
    if (!config) return;
    setSaving(true);
    const update: PipelineConfigUpdateRequest = {};

    if (strategy !== config.chunking.strategy || chunkSize !== config.chunking.chunk_size || overlap !== config.chunking.overlap) {
      update.chunking = { strategy, chunk_size: chunkSize, overlap };
    }
    if (mode !== config.retrieval.mode || topK !== config.retrieval.top_k || reranker !== config.retrieval.reranker_enabled) {
      update.retrieval = { mode, top_k: topK, reranker_enabled: reranker };
    }
    if (model !== config.generation.model) {
      update.generation = { model };
    }
    if (embProvider !== config.embedding.provider || embModel !== config.embedding.model || embDim !== config.embedding.dimension) {
      update.embedding = { provider: embProvider, model: embModel, dimension: embDim };
    }

    const result = await api.put<PipelineConfigResponse>("/api/config/", update);
    setConfig(result);
    setSaving(false);

    if (result.status.reindexing) {
      setPolling(true);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Pipeline Configuration</SheetTitle>
        </SheetHeader>

        {!config ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Chunking */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Chunking</h3>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Strategy</label>
                <Select value={strategy} onValueChange={(v) => v && setStrategy(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recursive">Recursive</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="semantic">Semantic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Chunk Size</label>
                  <Input type="number" value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Overlap</label>
                  <Input type="number" value={overlap} onChange={(e) => setOverlap(Number(e.target.value))} />
                </div>
              </div>
            </section>

            <Separator />

            {/* Retrieval */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Retrieval</h3>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Mode</label>
                <Select value={mode} onValueChange={(v) => v && setMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dense">Dense</SelectItem>
                    <SelectItem value="sparse">Sparse</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Top K</label>
                <Input type="number" value={topK} onChange={(e) => setTopK(Number(e.target.value))} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reranker"
                  checked={reranker}
                  onChange={(e) => setReranker(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="reranker" className="text-sm">Enable Reranker</label>
              </div>
            </section>

            <Separator />

            {/* Generation */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Generation</h3>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Model</label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
            </section>

            <Separator />

            {/* Embedding */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Embedding</h3>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Provider</label>
                <Select value={embProvider} onValueChange={(v) => v && setEmbProvider(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google (Gemini)</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Model</label>
                <Input value={embModel} onChange={(e) => setEmbModel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Dimension</label>
                <Input type="number" value={embDim} onChange={(e) => setEmbDim(Number(e.target.value))} />
              </div>
            </section>

            <Separator />

            {/* Status + Apply */}
            {polling && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Re-indexing documents...
              </div>
            )}

            <Button onClick={handleApply} disabled={saving || polling} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply Changes
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
