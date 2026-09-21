"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ProjectResponse } from "@/lib/types";
import { api } from "@/lib/api";

const STORAGE_KEY = "ragbench_active_project";

interface ProjectContextValue {
  activeProject: ProjectResponse | null;
  setActiveProject: (project: ProjectResponse | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<ProjectResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ProjectResponse;
        setActiveProjectState(parsed);
        // Sync backend active project
        api.post("/api/projects/active", { project_id: parsed.id }).catch(() => {});
      } catch {}
    }
    setHydrated(true);
  }, []);

  const setActiveProject = useCallback((project: ProjectResponse | null) => {
    setActiveProjectState(project);
    if (project) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Don't render children until hydration is done to avoid flicker
  if (!hydrated) return null;

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider");
  return ctx;
}
