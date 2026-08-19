"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderKanban, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "@/lib/api";
import type { ProjectResponse, ProjectCreateRequest } from "@/lib/types";
import { useProjectContext } from "@/context/project-context";
import { toast } from "sonner";

const COLORS = ["#E63946", "#F4C542", "#2563EB"];

export default function ProjectsPage() {
  const { activeProject, setActiveProject } = useProjectContext();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.get<ProjectResponse[]>("/api/projects/");
      setProjects(data);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const payload: ProjectCreateRequest = {
        name: newName.trim(),
        description: newDesc.trim() || null,
      };
      const created = await api.post<ProjectResponse>("/api/projects/", payload);
      setProjects((prev) => [created, ...prev]);
      setActiveProject(created);
      setNewName("");
      setNewDesc("");
      setShowForm(false);
      toast.success(`Project "${created.name}" created`);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(project: ProjectResponse) {
    if (!confirm(`Delete project "${project.name}"?`)) return;
    try {
      await api.del(`/api/projects/${project.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      if (activeProject?.id === project.id) setActiveProject(null);
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-end justify-between pb-5"
        style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-2" style={{ background: "#F4C542" }} />
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">Projects</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Isolate docs, datasets & eval runs
            </p>
          </div>
        </div>
        <motion.button
          onClick={() => setShowForm((v) => !v)}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-black uppercase tracking-widest text-white"
          style={{
            background: "#E63946",
            border: "3px solid oklch(0.10 0.01 240)",
            boxShadow: "5px 5px 0 oklch(0.10 0.01 240)",
            borderRadius: 0,
          }}
        >
          <Plus className="h-4 w-4" />
          New Project
        </motion.button>
      </motion.div>

      {/* Active project banner */}
      <AnimatePresence>
        {activeProject && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: "#F4C542",
              border: "3px solid oklch(0.10 0.01 240)",
              boxShadow: "4px 4px 0 oklch(0.10 0.01 240)",
            }}
          >
            <CheckCircle2 className="h-5 w-5 text-black shrink-0" />
            <span className="text-xs font-black uppercase tracking-widest text-black">Active:</span>
            <span className="font-black text-black">{activeProject.name}</span>
            <button
              onClick={() => setActiveProject(null)}
              className="ml-auto text-xs font-black uppercase tracking-widest text-black hover:underline"
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={handleCreate}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="p-6 space-y-4"
            style={{
              background: "white",
              border: "3px solid oklch(0.10 0.01 240)",
              boxShadow: "8px 8px 0 #2563EB",
            }}
          >
            <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "2px solid oklch(0.10 0.01 240)" }}>
              <div className="h-5 w-1.5" style={{ background: "#2563EB" }} />
              <h2 className="text-sm font-black uppercase tracking-widest">Create Project</h2>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. ML Docs Evaluation"
                className="w-full px-3 py-2.5 text-sm font-bold focus:outline-none"
                style={{
                  border: "2px solid oklch(0.10 0.01 240)",
                  borderRadius: 0,
                  background: "oklch(0.98 0.004 80)",
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2.5 text-sm font-bold focus:outline-none"
                style={{
                  border: "2px solid oklch(0.10 0.01 240)",
                  borderRadius: 0,
                  background: "oklch(0.98 0.004 80)",
                }}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-5 py-2.5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50"
                style={{
                  background: "#E63946",
                  border: "2px solid oklch(0.10 0.01 240)",
                  boxShadow: "4px 4px 0 oklch(0.10 0.01 240)",
                  borderRadius: 0,
                }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-sm font-black uppercase tracking-widest text-muted-foreground"
                style={{ border: "2px solid oklch(0.82 0.01 240)", borderRadius: 0 }}
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Projects list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-10 w-10 border-4"
            style={{ borderColor: "#F4C542", borderRadius: 0 }}
          />
        </div>
      ) : projects.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{ border: "3px dashed oklch(0.10 0.01 240)" }}
        >
          {/* Bauhaus empty state illustration */}
          <div className="relative mb-5">
            <div className="h-16 w-16" style={{ background: "#F4C542", border: "3px solid oklch(0.10 0.01 240)" }}>
              <div className="absolute top-2 left-2 h-8 w-8 rounded-full" style={{ background: "#E63946" }} />
            </div>
          </div>
          <p className="text-base font-black uppercase tracking-widest text-foreground">No Projects Yet</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Create a project to organize your docs and evals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project, i) => {
            const isActive = activeProject?.id === project.id;
            const color = COLORS[i % COLORS.length];
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ x: 4 }}
                className="flex items-center gap-4 px-4 py-4 cursor-pointer transition-all"
                style={{
                  background: isActive ? color : "white",
                  border: `3px solid oklch(0.10 0.01 240)`,
                  boxShadow: isActive ? `6px 6px 0 oklch(0.10 0.01 240)` : "4px 4px 0 oklch(0.82 0.01 240)",
                }}
                onClick={() => setActiveProject(isActive ? null : project)}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center"
                  style={{ background: isActive ? "oklch(0.10 0.01 240)" : color }}
                >
                  <FolderKanban className="h-5 w-5" style={{ color: isActive ? color : "white" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-black uppercase tracking-wide truncate"
                      style={{
                        color:
                          isActive && color === "#F4C542"
                            ? "oklch(0.10 0.01 240)"
                            : isActive
                            ? "white"
                            : "inherit",
                      }}
                    >
                      {project.name}
                    </span>
                    {isActive && (
                      <span
                        className="text-xs font-black uppercase tracking-widest px-1.5 py-0.5"
                        style={{ background: "oklch(0.10 0.01 240)", color: color }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p
                      className="text-xs font-medium mt-0.5 truncate"
                      style={{
                        color:
                          isActive && color === "#F4C542"
                            ? "rgba(0,0,0,0.75)"
                            : isActive
                            ? "rgba(255,255,255,0.75)"
                            : "oklch(0.52 0.02 240)",
                      }}
                    >
                      {project.description}
                    </p>
                  )}
                  <p
                    className="text-xs mt-0.5"
                    style={{
                      color:
                        isActive && color === "#F4C542"
                          ? "rgba(0,0,0,0.5)"
                          : isActive
                          ? "rgba(255,255,255,0.5)"
                          : "oklch(0.70 0.01 240)",
                    }}
                  >
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project);
                  }}
                  className="shrink-0 p-2 transition-colors"
                  style={{
                    color:
                      isActive && color === "#F4C542"
                        ? "oklch(0.10 0.01 240)"
                        : isActive
                        ? "white"
                        : "oklch(0.52 0.02 240)",
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
