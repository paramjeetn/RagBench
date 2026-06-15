"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ProjectResponse } from "@/lib/types";

interface ProjectContextValue {
  activeProject: ProjectResponse | null;
  setActiveProject: (project: ProjectResponse | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<ProjectResponse | null>(null);

  const setActiveProject = useCallback((project: ProjectResponse | null) => {
    setActiveProjectState(project);
  }, []);

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
