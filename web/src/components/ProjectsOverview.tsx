"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSignedUrlsCached } from "@/lib/signedUrlCache";
import { deleteProjectAction, cancelJob } from "@/app/actions";
import type { Project, Job } from "@/lib/types";
import { isFinal } from "@/lib/format";
import ProjectCard from "./ProjectCard";
import CreateProjectModal from "./CreateProjectModal";
import JobProgressCard from "./JobProgressCard";
import {
  FolderKanban,
  Plus,
  ArrowLeft,
  Film,
  Search,
} from "./Icons";

interface ProjectsOverviewProps {
  userId: string;
  initialProjects: Project[];
}

export default function ProjectsOverview({
  userId,
  initialProjects,
}: ProjectsOverviewProps) {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});

  // Carregar URLs assinadas das miniaturas dos projetos (com cache)
  useEffect(() => {
    const pathsToSign: string[] = [];
    projects.forEach((proj: any) => {
      if (proj.thumbnail_url) return;

      const projJobs = proj.jobs || [];
      for (const j of projJobs) {
        if (j.clips && j.clips.length > 0) {
          // Prioriza thumbnail leve se disponível
          const withThumb = j.clips.find((c: any) => Boolean(c.thumbnail_url));
          const targetPath = withThumb?.thumbnail_url || j.clips.find((c: any) => Boolean(c.file_path))?.file_path;
          if (targetPath && !urls[targetPath] && !pathsToSign.includes(targetPath)) {
            pathsToSign.push(targetPath);
            break;
          }
        }
      }
    });

    if (pathsToSign.length === 0) return;

    getSignedUrlsCached(supabase, "clips", pathsToSign).then((signedMap) => {
      setUrls((prev) => ({ ...prev, ...signedMap }));
    });
  }, [projects, supabase, urls]);

  const refreshData = useCallback(async () => {
    const [{ data: pData }, { data: jData }] = await Promise.all([
      supabase
        .from("projects")
        .select("*, jobs:jobs(id, clips:clips!clips_job_id_fkey(id, file_path, thumbnail_url))")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("jobs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (pData) setProjects(pData as any);
    if (jData) setJobs(jData as Job[]);
  }, [supabase, userId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Polling auxiliar enquanto houver jobs ativos
  const hasActive = jobs.some((j) => !isFinal(j.status));
  useEffect(() => {
    const intervalMs = hasActive ? 3000 : 15000;
    const t = setInterval(refreshData, intervalMs);
    return () => clearInterval(t);
  }, [hasActive, refreshData]);

  async function handleCancel(jobId: string) {
    if (!confirm("Tem certeza que deseja cancelar o processamento deste vídeo?")) return;
    setCancelingId(jobId);
    try {
      const res = await cancelJob(jobId);
      if (res && !res.success && res.error) {
        alert(`Não foi possível cancelar: ${res.error}`);
        return;
      }
      await refreshData();
    } catch (err: any) {
      alert(`Erro inesperado ao cancelar: ${err?.message || "Tente novamente."}`);
    } finally {
      setCancelingId(null);
    }
  }

  const activeJobs = jobs.filter((j) => !isFinal(j.status));

  async function handleDeleteProject(projectId: string) {
    if (!confirm("Deseja realmente excluir este projeto? Os vídeos associados ficarão desvinculados.")) return;
    try {
      await deleteProjectAction(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error("Erro ao deletar projeto:", err);
    }
  }

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const term = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term))
    );
  }, [projects, search]);

  return (
    <div className="stack-lg" style={{ maxWidth: "1280px", margin: "0 auto", padding: "1rem 0" }}>
      {/* Barra de Navegação / Topo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            href="/"
            className="btn btn-secondary btn-small"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
          >
            <ArrowLeft size={14} />
            <span>Voltar ao Início</span>
          </Link>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FolderKanban size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Meus Projetos</h1>
            <p className="muted small" style={{ margin: 0 }}>
              Gerencie seus cortes organizados por pastas e workspaces estilo CapCut
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 700,
            }}
          >
            <Plus size={16} />
            <span>Novo Projeto</span>
          </button>
        </div>
      </div>

      {/* STATUS DO CORTE E DA CLONAGEM (DENTRO DE MEUS PROJETOS) */}
      {activeJobs.map((job) => {
        const relatedProject = projects.find((p) => p.id === job.project_id);
        return (
          <JobProgressCard
            key={job.id}
            job={job}
            onCancel={handleCancel}
            canceling={cancelingId === job.id}
            projectName={relatedProject?.name}
          />
        );
      })}

      {/* Barra de Busca e Filtro */}
      <div
        className="card"
        style={{
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: "260px", flex: 1, maxWidth: "420px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="Buscar projeto por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "2.3rem", width: "100%" }}
          />
        </div>
        <span className="muted small">
          Total: <strong>{filteredProjects.length}</strong> de <strong>{projects.length}</strong> projeto(s)
        </span>
      </div>

      {/* Grid de Projetos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {/* Card Pontilhado Criar Novo Projeto */}
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "2px dashed var(--card-border)",
            borderRadius: "14px",
            padding: "2.5rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            cursor: "pointer",
            transition: "all 0.2s ease",
            color: "var(--text-muted)",
            minHeight: "220px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--primary)";
            e.currentTarget.style.color = "var(--primary)";
            e.currentTarget.style.background = "rgba(139, 92, 246, 0.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--card-border)";
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--card-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "inherit",
            }}
          >
            <Plus size={22} />
          </div>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Criar Novo Projeto</span>
          <small style={{ fontSize: "0.78rem", opacity: 0.7 }}>Organize seus cortes temáticos</small>
        </button>

        {/* Lista de Projetos */}
        {filteredProjects.map((proj: any) => {
          const projJobs = (proj.jobs || []) as { id: string; clips?: { id: string; file_path: string; thumbnail_url?: string | null }[] }[];
          let totalClips = 0;
          let firstClipPath: string | null = null;
          projJobs.forEach((pj) => {
            if (pj.clips && pj.clips.length > 0) {
              totalClips += pj.clips.length;
              if (!firstClipPath) {
                const withThumb = pj.clips.find((c: any) => Boolean(c.thumbnail_url));
                if (withThumb?.thumbnail_url) {
                  firstClipPath = withThumb.thumbnail_url;
                } else {
                  const found = pj.clips.find((c: any) => Boolean(c.file_path));
                  if (found?.file_path) {
                    firstClipPath = found.file_path;
                  }
                }
              }
            }
          });

          const projActiveJob = jobs.find((j) => j.project_id === proj.id && !isFinal(j.status));
          const effectiveThumbnail =
            proj.thumbnail_url ||
            (firstClipPath && urls[firstClipPath] ? urls[firstClipPath] : null);

          return (
            <ProjectCard
              key={proj.id}
              project={proj}
              clipsCount={totalClips}
              thumbnailUrl={effectiveThumbnail}
              activeJob={projActiveJob}
              onDelete={handleDeleteProject}
            />
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "4rem 2rem", marginTop: "1rem" }}>
          <Film size={48} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 1rem", opacity: 0.5 }} />
          <h3>Nenhum projeto encontrado</h3>
          <p className="muted small" style={{ maxWidth: "420px", margin: "0 auto 1.5rem" }}>
            Crie pastas temáticas para separar seus cortes de podcast, lives, vídeos curtos e muito mais.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={16} />
            <span>Criar Primeiro Projeto</span>
          </button>
        </div>
      )}

      {/* Modal Criar Projeto */}
      <CreateProjectModal
        isOpen={isCreateOpen}
        userId={userId}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          refreshData();
        }}
      />
    </div>
  );
}
