"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderKanban, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ProjectResponse, ProjectCreateRequest } from "@/lib/types";
import { useProjectContext } from "@/context/project-context";
import { toast } from "sonner";

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
      toast.success(`Project "${created.name}" created and set as active`);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(project: ProjectResponse) {
    if (!confirm(`Delete project "${project.name}"? Documents and evals will be unlinked.`)) return;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Isolate documents, datasets, and eval runs per project.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Active project banner */}
      {activeProject && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-muted-foreground">Active project:</span>
          <span className="font-medium text-foreground">{activeProject.name}</span>
          <button
            onClick={() => setActiveProject(null)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-border bg-card p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold">Create Project</h2>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. ML Docs Evaluation"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Projects list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create a project to organize your documents and evals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const isActive = activeProject?.id === project.id;
            return (
              <div
                key={project.id}
                className={`flex items-center gap-4 rounded-lg border px-4 py-4 transition-colors cursor-pointer ${
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                }`}
                onClick={() => setActiveProject(isActive ? null : project)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <FolderKanban className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{project.name}</span>
                    {isActive && (
                      <span className="text-xs rounded-full bg-primary/15 text-primary px-2 py-0.5 font-medium">
                        active
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground/50 mt-0.5">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project);
                  }}
                  className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
