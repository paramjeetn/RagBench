import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { EvalRunResponse } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function runLabel(run: EvalRunResponse): string {
  if (run.name) return run.name;
  const cfg = run.config as Record<string, Record<string, unknown>> | undefined;
  const s = cfg?.chunking?.strategy ?? "?";
  const r = cfg?.retrieval?.reranker_enabled ? "+rerank" : "";
  const d = new Date(run.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const shortId = run.id.slice(-4);
  return `${s}${r} (${d} #${shortId})`;
}

export function formatScore(value: number): string {
  return (value * 100).toFixed(1) + "%";
}

export function formatDelta(value: number): string {
  const pct = (value * 100).toFixed(1);
  return value >= 0 ? `+${pct}%` : `${pct}%`;
}
