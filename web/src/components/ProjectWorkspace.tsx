"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { updateProjectAction, deleteUserClip, cancelJob, requestClipTrimAction, saveClipCanvasBrollsAction } from "@/app/actions";
import type { Project, Job, Clip, CanvasBroll } from "@/lib/types";
import { fmtDate, isFinal, fmtClock } from "@/lib/format";
import ClipEditorModal from "./ClipEditorModal";
import StatusBadge from "./StatusBadge";
import NewJobForm from "./NewJobForm";
import CopyStyleStudio from "./CopyStyleStudio";
import JobProgressCard from "./JobProgressCard";
import {
  ArrowLeft,
  Film,
  Scissors,
  Sparkles,
  DownloadIcon,
  TrashIcon,
  Play,
  Pencil,
  Check,
  Plus,
  Video,
  Monitor,
  Smartphone,
  TrendingUp,
} from "./Icons";

interface ProjectWorkspaceProps {
  initialProject: Project;
  initialJobs: Job[];
  initialClips: Clip[];
  userId: string;
}

export default function ProjectWorkspace({
  initialProject,
  initialJobs,
  initialClips,
  userId,
}: ProjectWorkspaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [project, setProject] = useState<Project>(initialProject);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [activeTab, setActiveTab] = useState<"cortes" | "novo_video" | "clonar">("cortes");

  // Edição rápida do nome do projeto
  const [isEditingName, setIsEditingName] = useState(false);
  const [projectName, setProjectName] = useState(project.name);

  // Editor Modal de Clipe
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);

  // URLs assinadas dos clipes para streaming seguro
  const [urls, setUrls] = useState<Record<string, string>>({});

  const refreshProjectData = useCallback(async () => {
    // 1. Atualizar projeto
    const { data: p } = await supabase.from("projects").select("*").eq("id", project.id).single();
    if (p) setProject(p as Project);

    // 2. Atualizar jobs do projeto
    const { data: jList } = await supabase
      .from("jobs")
      .select("*, clips:clips!clips_job_id_fkey (*)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });

    if (jList) {
      setJobs(jList as Job[]);
      const allClips: Clip[] = [];
      jList.forEach((j: any) => {
        if (j.clips && Array.isArray(j.clips)) {
          allClips.push(...j.clips);
        }
      });
      setClips(allClips);
    }
  }, [supabase, project.id]);

  // Carregar URLs assinadas
  useEffect(() => {
    const pathsToSign: string[] = [];
    clips.forEach((c) => {
      if (c.file_path && !urls[c.file_path]) {
        pathsToSign.push(c.file_path);
      }
    });

    if (pathsToSign.length === 0) return;

    supabase.storage
      .from("clips")
      .createSignedUrls(pathsToSign, 3600)
      .then(({ data }) => {
        if (!data) return;
        setUrls((prev) => {
          const next = { ...prev };
          data.forEach((d) => {
            if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
          });
          return next;
        });
      });
  }, [clips, supabase, urls]);

  // Realtime subscription para clipes gerados deste projeto
  useEffect(() => {
    const channel = supabase
      .channel(`project-workspace-${project.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `project_id=eq.${project.id}` },
        () => refreshProjectData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, project.id, refreshProjectData]);

  async function handleSaveName() {
    if (!projectName.trim()) return;
    setIsEditingName(false);
    try {
      await updateProjectAction(project.id, { name: projectName.trim() });
      setProject((prev) => ({ ...prev, name: projectName.trim() }));
    } catch {}
  }

  async function handleDeleteClip(clipId: string) {
    if (!confirm("Deseja apagar permanentemente este clipe do projeto?")) return;
    setDeletingClipId(clipId);
    try {
      await deleteUserClip(clipId);
      setClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch {}
    setDeletingClipId(null);
  }

  // Cancelamento de processamento
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  async function handleCancel(jobId: string) {
    if (!confirm("Tem certeza que deseja cancelar o processamento deste vídeo?")) return;
    setCancelingId(jobId);
    try {
      const res = await cancelJob(jobId);
      if (res && !res.success && res.error) {
        alert(`Não foi possível cancelar: ${res.error}`);
        return;
      }
      await refreshProjectData();
    } catch (err: any) {
      alert(`Erro inesperado ao cancelar: ${err?.message || "Tente novamente."}`);
    } finally {
      setCancelingId(null);
    }
  }

  // Polling auxiliar enquanto houver job ativo
  const hasActive = jobs.some((j) => !isFinal(j.status));
  useEffect(() => {
    const intervalMs = hasActive ? 3000 : 15000;
    const t = setInterval(refreshProjectData, intervalMs);
    return () => clearInterval(t);
  }, [hasActive, refreshProjectData]);

  const activeJobs = jobs.filter((j) => !isFinal(j.status));

  return (
    <div className="stack-lg">
      {/* Barra de Navegação Superior do Projeto */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            href="/"
            className="btn btn-secondary btn-small"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none" }}
          >
            <ArrowLeft size={14} />
            <span>Todos os Projetos</span>
          </Link>

          <span className="muted">/</span>

          {isEditingName ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="text"
                className="input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                style={{ padding: "0.2rem 0.5rem", fontSize: "1.1rem", fontWeight: 700 }}
              />
              <button type="button" className="btn btn-primary btn-small" onClick={handleSaveName}>
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
              onClick={() => setIsEditingName(true)}
              title="Clique para renomear este projeto"
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>{project.name}</h2>
              <Pencil size={14} className="muted" />
            </div>
          )}
        </div>

        {/* Resumo de Clipes e Ações */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            className="badge badge-accent"
            style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem", display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <Scissors size={14} />
            <strong>{clips.length}</strong> corte{clips.length === 1 ? "" : "s"} disponíveis
          </span>
          <span className="muted small">Criado em {fmtDate(project.created_at)}</span>
        </div>
      </div>

      {/* STATUS DO CORTE E DA CLONAGEM (DENTRO DO PROJETO) */}
      {activeJobs.map((job) => (
        <JobProgressCard
          key={job.id}
          job={job}
          onCancel={handleCancel}
          canceling={cancelingId === job.id}
          projectName={project.name}
        />
      ))}

      {/* Abas Internas de Trabalho do Projeto (CapCut Style) */}
      <div className="segmented-control" style={{ maxWidth: "560px" }}>
        <button
          type="button"
          className={`segmented-btn ${activeTab === "cortes" ? "active" : ""}`}
          onClick={() => setActiveTab("cortes")}
        >
          <Film size={15} />
          <span>Clipes do Projeto ({clips.length})</span>
        </button>

        <button
          type="button"
          className={`segmented-btn ${activeTab === "novo_video" ? "active" : ""}`}
          onClick={() => setActiveTab("novo_video")}
        >
          <Plus size={15} />
          <span>+ Adicionar Vídeo / Gerar Cortes</span>
        </button>

        <button
          type="button"
          className={`segmented-btn ${activeTab === "clonar" ? "active" : ""}`}
          onClick={() => setActiveTab("clonar")}
        >
          <Sparkles size={15} />
          <span>Clonar Estilo para o Projeto</span>
        </button>
      </div>

      {/* ========================================================
          ABA 1: GALERIA DE CLIPES DESTE PROJETO
      ======================================================== */}
      {activeTab === "cortes" && (
        <section className="stack">
          {clips.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "3.5rem 1.5rem",
                background: "var(--card-bg)",
                borderRadius: "16px",
                border: "1px dashed var(--card-border)",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "rgba(139, 92, 246, 0.12)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1rem",
                }}
              >
                <Scissors size={28} />
              </div>
              {activeJobs.length > 0 ? (
                <>
                  <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.2rem" }}>Processando corte ou clonagem para este projeto…</h3>
                  <p className="muted small" style={{ maxWidth: "420px", margin: "0 auto" }}>
                    A inteligência artificial está renderizando seus clipes. Acompanhe a etapa e o terminal no monitor acima!
                  </p>
                </>
              ) : (
                <>
                  <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.2rem" }}>Nenhum corte gerado ainda neste projeto</h3>
                  <p className="muted small" style={{ maxWidth: "420px", margin: "0 auto 1.25rem" }}>
                    Envie um vídeo bruto ou cole um link na aba <strong>"+ Adicionar Vídeo"</strong> para a IA extrair automaticamente os melhores momentos aqui dentro.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setActiveTab("novo_video")}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: "0 auto" }}
                  >
                    <Plus size={16} />
                    <span>Adicionar Primeiro Vídeo do Projeto</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid-clips" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "1.25rem" }}>
              {clips.map((clip) => {
                const videoUrl = clip.file_path ? urls[clip.file_path] : undefined;
                const duration = Math.max(1, Math.round(Number(clip.end_seconds) - Number(clip.start_seconds)));

                return (
                  <div
                    key={clip.id}
                    className="card clip-card"
                    style={{
                      padding: 0,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: "12px",
                      border: "1px solid var(--card-border)",
                    }}
                  >
                    {/* Player de Prévia */}
                    <div style={{ position: "relative", width: "100%", background: "#000", aspectRatio: "9/16", maxHeight: "420px" }}>
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Film size={32} />
                        </div>
                      )}

                      {/* Badge de Score Viral */}
                      {clip.score && (
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            left: "8px",
                            background: "rgba(16, 185, 129, 0.9)",
                            color: "#fff",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <TrendingUp size={12} /> {clip.score}% Viral
                        </div>
                      )}

                      {/* Duração */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          right: "8px",
                          background: "rgba(0, 0, 0, 0.75)",
                          color: "#fff",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      >
                        {duration}s
                      </div>
                    </div>

                    {/* Informações e Ações do Corte */}
                    <div style={{ padding: "0.85rem", display: "flex", flexDirection: "column", flex: 1, gap: "0.4rem" }}>
                      <strong style={{ fontSize: "0.92rem", color: "var(--text)", lineHeight: 1.3 }}>
                        {clip.title}
                      </strong>

                      {clip.hook && (
                        <p className="muted small" style={{ margin: 0, fontSize: "0.78rem", fontStyle: "italic" }}>
                          "{clip.hook}"
                        </p>
                      )}

                      <div style={{ display: "flex", gap: "0.4rem", marginTop: "auto", paddingTop: "0.6rem" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => setEditingClip(clip)}
                          style={{ flex: 1, justifyContent: "center", fontSize: "0.76rem" }}
                        >
                          <Scissors size={13} style={{ marginRight: "4px" }} />
                          Editar / Ajustar
                        </button>

                        {videoUrl && (
                          <a
                            href={videoUrl}
                            download={`corte-${clip.position}.mp4`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-small"
                            style={{ padding: "0.3rem 0.55rem" }}
                            title="Baixar vídeo do corte"
                          >
                            <DownloadIcon size={14} />
                          </a>
                        )}

                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleDeleteClip(clip.id)}
                          disabled={deletingClipId === clip.id}
                          style={{ color: "var(--danger)", padding: "0.3rem", background: "transparent", border: "none", cursor: "pointer" }}
                          title="Excluir corte"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          ABA 2: ADICIONAR VÍDEO DENTRO DESTE PROJETO
      ======================================================== */}
      {activeTab === "novo_video" && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.15rem" }}>
              Adicionar Vídeo ao Projeto: <strong>{project.name}</strong>
            </h3>
            <p className="muted small" style={{ margin: 0 }}>
              Todos os cortes gerados por este envio serão automaticamente organizados dentro deste workspace.
            </p>
          </div>

          <NewJobForm
            userId={userId}
            projectId={project.id}
            onCreated={() => {
              setActiveTab("cortes");
              refreshProjectData();
            }}
          />
        </div>
      )}

      {/* ========================================================
          ABA 3: CLONAR ESTILO PARA ESTE PROJETO
      ======================================================== */}
      {activeTab === "clonar" && (
        <div>
          <div className="card" style={{ marginBottom: "1rem", padding: "1rem 1.25rem" }}>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem" }}>
              Clonagem de Edição no Projeto: <strong>{project.name}</strong>
            </h3>
            <p className="muted small" style={{ margin: 0 }}>
              Aplique estilos virais em lote. Os novos clipes renderizados serão vinculados a este projeto.
            </p>
          </div>

          <CopyStyleStudio
            userId={userId}
            projectId={project.id}
            onCreated={() => {
              setActiveTab("cortes");
              refreshProjectData();
            }}
          />
        </div>
      )}

      {/* Modal do Editor de Cortes (CapCut Editor completo) */}
      {editingClip && (
        <ClipEditorModal
          clip={editingClip}
          videoSrc={editingClip.file_path ? urls[editingClip.file_path] : undefined}
          userId={userId}
          projectId={project.id}
          onClose={() => setEditingClip(null)}
          onUpdateClipTime={async (clipId, trimStart, trimEnd, canvasBrolls) => {
            const res = await requestClipTrimAction(clipId, trimStart, trimEnd, canvasBrolls);
            if (!res.success) {
              throw new Error(res.error || "Falha ao ajustar corte.");
            }
            await refreshProjectData();
          }}
          onSaveCanvasBrolls={async (clipId, brolls) => {
            const res = await saveClipCanvasBrollsAction(clipId, brolls);
            if (!res.success) {
              throw new Error(res.error || "Falha ao salvar b-rolls.");
            }
            await refreshProjectData();
          }}
        />
      )}
    </div>
  );
}
