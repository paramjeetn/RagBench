"use client";

import { useEffect, useState, useCallback } from "react";
import { FolderKanban, ChevronDown, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "@/lib/api";
import type { ProjectResponse } from "@/lib/types";
import { useProjectContext } from "@/context/project-context";

export function ProjectBar() {
  const { activeProject, setActiveProject } = useProjectContext();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get<ProjectResponse[]>("/api/projects/");
      setProjects(data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const switchProject = async (project: ProjectResponse) => {
    setActiveProject(project);
    setOpen(false);
    try {
      await api.post("/api/projects/active", { project_id: project.id });
    } catch {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<ProjectResponse>("/api/projects/", { name: newName.trim() });
      setProjects((prev) => [created, ...prev]);
      await switchProject(created);
      setNewName("");
    } catch {}
    setCreating(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-all"
        style={{
          background: activeProject ? "#F4C542" : "#E63946",
          border: "2px solid oklch(0.10 0.01 240)",
          boxShadow: "3px 3px 0 oklch(0.10 0.01 240)",
          borderRadius: 0,
          color: activeProject ? "oklch(0.10 0.01 240)" : "white",
        }}
      >
        <FolderKanban className="h-3.5 w-3.5" />
        <span className="max-w-[160px] truncate">
          {activeProject ? activeProject.name : "⚠ Select Project"}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 top-full z-50 mt-1 w-72"
            style={{
              background: "white",
              border: "3px solid oklch(0.10 0.01 240)",
              boxShadow: "6px 6px 0 oklch(0.10 0.01 240)",
            }}
          >
            {/* Create new */}
            <form onSubmit={handleCreate} className="flex gap-2 p-2" style={{ borderBottom: "2px solid oklch(0.90 0.01 240)" }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New project name..."
                className="flex-1 px-2 py-1 text-xs font-bold focus:outline-none"
                style={{ border: "1.5px solid oklch(0.10 0.01 240)", borderRadius: 0 }}
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-2 py-1 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                style={{ background: "#2563EB", border: "1.5px solid oklch(0.10 0.01 240)", borderRadius: 0 }}
              >
                <Plus className="h-3 w-3" />
              </button>
            </form>

            {/* Project list */}
            <div className="max-h-64 overflow-y-auto">
              {projects.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground font-medium">No projects yet. Create one above.</p>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => switchProject(p)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition-colors hover:bg-muted/50"
                  style={{ background: activeProject?.id === p.id ? "#F4C542" : undefined }}
                >
                  <FolderKanban
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: activeProject?.id === p.id ? "black" : "#2563EB" }}
                  />
                  <span className="truncate" style={{ color: activeProject?.id === p.id ? "black" : "inherit" }}>
                    {p.name}
                  </span>
                  {activeProject?.id === p.id && (
                    <span className="ml-auto text-[10px] font-black">✓ Active</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
