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

  // Hydrate from localStorage on mount, then validate the project still exists in DB.
  // After `make clean-slate` the DB is wiped but localStorage keeps the stale project —
  // this causes uploads to use a dead project_id and docs to never appear.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    const validate = async () => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ProjectResponse;
          // Verify the project still exists in the backend
          const allProjects = await api.get<ProjectResponse[]>("/api/projects/");
          const stillExists = allProjects.some((p) => p.id === parsed.id);
          if (stillExists) {
            setActiveProjectState(parsed);
            api.post("/api/projects/active", { project_id: parsed.id }).catch(() => {});
          } else {
            // DB was wiped — clear stale localStorage entry
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          // Network error — optimistically keep the stored project but don't crash
          try {
            const parsed = JSON.parse(stored) as ProjectResponse;
            setActiveProjectState(parsed);
          } catch {}
        }
      }
      setHydrated(true);
    };

    validate();
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
