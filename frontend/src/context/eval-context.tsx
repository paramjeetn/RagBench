"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { EvalRunResponse } from "@/lib/types";

interface EvalContextValue {
  activeRun: EvalRunResponse | null;
  setActiveRun: (run: EvalRunResponse | null) => void;
}

const EvalContext = createContext<EvalContextValue | null>(null);

export function EvalProvider({ children }: { children: React.ReactNode }) {
  const [activeRun, setActiveRunState] = useState<EvalRunResponse | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setActiveRun = useCallback((run: EvalRunResponse | null) => {
    setActiveRunState(run);
  }, []);

  // Poll active run
  useEffect(() => {
    if (!activeRun || activeRun.status !== "running") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const updated = await api.get<EvalRunResponse>(
          `/api/eval/runs/${activeRun.id}`
        );
        setActiveRunState(updated);

        if (updated.status !== "running" && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeRun?.id, activeRun?.status]);

  // On mount, check for any running eval
  useEffect(() => {
    api
      .get<EvalRunResponse[]>("/api/eval/runs")
      .then(async (allRuns) => {
        const running = allRuns.find((r) => r.status === "running");
        if (running) {
          const full = await api.get<EvalRunResponse>(
            `/api/eval/runs/${running.id}`
          );
          setActiveRunState(full);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <EvalContext.Provider value={{ activeRun, setActiveRun }}>
      {children}
    </EvalContext.Provider>
  );
}

export function useEvalContext() {
  const ctx = useContext(EvalContext);
  if (!ctx) throw new Error("useEvalContext must be used within EvalProvider");
  return ctx;
}
