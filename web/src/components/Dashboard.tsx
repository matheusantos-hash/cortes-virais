"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelJob, deleteUserJob, deleteUserClip } from "@/app/actions";
import { fmtClock, fmtDate, isFinal, jobTitle } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Clip, Job, JobStatus } from "@/lib/types";
import NewJobForm from "./NewJobForm";
import CopyStyleStudio from "./CopyStyleStudio";
import ModeSelectorCards, { DashboardMode } from "./ModeSelectorCards";
import PowerShellTerminal from "./PowerShellTerminal";
import StatusBadge from "./StatusBadge";
import {
  DownloadIcon,
  TrashIcon,
  TrendingUpIcon,
  ActivityIcon,
  SparklesIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  SmartphoneIcon,
  MonitorIcon,
  BookOpen,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  X,
  Film,
  User,
  Users,
  AlertTriangle,
} from "./Icons";

function getStageDescription(status: JobStatus): string {
  switch (status) {
    case "queued":
      return "Aguardando na fila de processamento do servidor…";
    case "downloading":
      return "Baixando vídeo fonte em alta qualidade com yt-dlp…";
    case "transcribing":
      return "Transcrevendo áudio e sincronizando falas com Deepgram AI…";
    case "analyzing":
      return "Claude Sonnet analisando ganchos virais e roteiro…";
    case "cutting":
      return "Renderizando cortes e sobrepondo B-rolls com FFmpeg…";
    case "done":
      return "Processamento concluído com sucesso!";
    case "failed":
      return "Falha durante o processamento.";
    case "canceled":
      return "Processamento cancelado pelo usuário.";
    default:
      return "Processando…";
  }
}

export default function Dashboard({ userId, initialJobs }: { userId: string; initialJobs: Job[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [activeMode, setActiveMode] = useState<DashboardMode>("cortes");
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [showTerminal, setShowTerminal] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*, clips:clips!clips_job_id_fkey (*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setJobs(data as Job[]);
  }, [supabase, userId]);

  // Links temporários para reproduzir os clipes (bucket privado)
  useEffect(() => {
    const allPaths: string[] = [];
    jobs.forEach((j) => {
      j.clips?.forEach((c) => {
        if (c.file_path && !urls[c.file_path]) {
          allPaths.push(c.file_path);
        }
      });
    });

    if (allPaths.length === 0) return;

    supabase.storage
      .from("clips")
      .createSignedUrls(allPaths, 3600)
      .then(({ data }) => {
        if (!data) return;
        setUrls((current) => {
          const next = { ...current };
          data.forEach((d) => {
            if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
          });
          return next;
        });
      });
  }, [jobs, supabase, urls]);

  async function handleCancel(jobId: string) {
    if (!confirm("Tem certeza que deseja cancelar o processamento deste vídeo?")) return;
    setCancelingId(jobId);
    try {
      const res = await cancelJob(jobId);
      if (res && !res.success && res.error) {
        alert(`Não foi possível cancelar: ${res.error}`);
        return;
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "canceled", error: "Cancelado pelo usuário." } : j))
      );
      await refresh();
    } catch (err: any) {
      console.error("Erro ao cancelar:", err);
      alert(`Erro inesperado ao cancelar: ${err?.message || "Tente novamente."}`);
    } finally {
      setCancelingId(null);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm("Tem certeza que deseja excluir este projeto e todos os seus clipes gerados?")) return;
    setDeletingId(jobId);
    try {
      const res = await deleteUserJob(jobId);
      if (res && !res.success && res.error) {
        alert(`Não foi possível excluir: ${res.error}`);
        return;
      }
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err: any) {
      console.error("Erro ao excluir:", err);
      alert(`Erro ao excluir: ${err?.message || "Tente novamente."}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteClip(clipId: string, jobId: string) {
    if (!confirm("Tem certeza que deseja apagar permanentemente este clipe?")) return;
    setDeletingClipId(clipId);
    try {
      const res = await deleteUserClip(clipId);
      if (res && !res.success && res.error) {
        alert(`Não foi possível excluir o clipe: ${res.error}`);
        return;
      }
      setJobs((prev) =>
        prev.map((j) => {
          if (j.id === jobId) {
            return {
              ...j,
              clips: (j.clips ?? []).filter((c) => c.id !== clipId),
            };
          }
          return j;
        })
      );
    } catch (err: any) {
      console.error("Erro ao excluir clipe:", err);
      alert(`Erro ao excluir clipe: ${err?.message || "Tente novamente."}`);
    } finally {
      setDeletingClipId(null);
    }
  }

  async function download(clip: Clip) {
    if (!clip.file_path) return;
    setDownloadingId(clip.id);
    const name = `corte-${String(clip.position).padStart(2, "0")}.mp4`;
    const { data, error } = await supabase.storage.from("clips").createSignedUrl(clip.file_path, 300, { download: name });
    setDownloadingId(null);
    if (error || !data?.signedUrl) {
      alert("Não foi possível gerar link de download para este clipe. Verifique sua conexão ou tente novamente.");
      return;
    }
    window.location.href = data.signedUrl;
  }

  // Progresso ao vivo (Realtime)
  useEffect(() => {
    const channel = supabase
      .channel("jobs-dashboard-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${userId}` }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, refresh]);

  // Polling auxiliar resiliente: a cada 3s se houver job em andamento, ou a cada 15s como fallback
  const hasActive = jobs.some((j) => !isFinal(j.status));
  useEffect(() => {
    const intervalMs = hasActive ? 3000 : 15000;
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [hasActive, refresh]);

  // Primeiro job em andamento (para o painel de monitoramento ativo)
  const activeJob = jobs.find((j) => !isFinal(j.status));

  return (
    <div className="stack-lg">
      {/* 2 GRANDES CARDS/BOTÕES: CORTES vs COPIAR ESTILO */}
      <ModeSelectorCards currentMode={activeMode} onSelectMode={setActiveMode} />

      <div className={`app-grid ${activeMode === "copiar_estilo" ? "studio-layout" : ""}`}>
        {/* COLUNA ESQUERDA: Formulário do Modo Escolhido */}
        <aside className="stack">
          {activeMode === "cortes" ? (
            <>
              <Link href="/ajuda" className="help-banner">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  <BookOpen size={16} style={{ color: "var(--primary)" }} /> <strong>Primeira vez aqui?</strong> Veja como funcionam legendas, B-Rolls com IA e as demais funções.
                </span>
                <span className="help-banner-arrow" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                  Central de Ajuda <ArrowRight size={14} />
                </span>
              </Link>
              <NewJobForm userId={userId} onCreated={refresh} />
            </>
          ) : (
            <CopyStyleStudio userId={userId} onCreated={refresh} />
          )}
        </aside>

        {/* COLUNA DIREITA (1fr): Monitor Ativo & Galeria de Clipes */}
        <section className="stack-lg" id="galeria-monitor">
        {/* CARD DE PROGRESSO ATIVO (Aparece dinamicamente ao iniciar um corte) */}
        {activeJob && (
          <div className="card progress-card-active stack">
            <div className="progress-header">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ justifyContent: "flex-start", gap: "0.5rem", marginBottom: "0.3rem" }}>
                  <span className="badge badge-queued" style={{ animation: "pulse-dot 2s infinite" }}>
                    ● EM ANDAMENTO
                  </span>
                  <StatusBadge status={activeJob.status} />
                </div>
                <h3 className="ellipsis" style={{ fontSize: "1.2rem", margin: 0 }}>
                  {jobTitle(activeJob)}
                </h3>
              </div>
              <div className="progress-pct-huge">
                {activeJob.progress}%
              </div>
            </div>

            {/* Barra de Progresso Animada Neon */}
            <div className="bar" style={{ height: "11px" }}>
              <div className="bar-fill" style={{ width: `${Math.max(activeJob.progress, 5)}%` }} />
            </div>

            {/* Mensagem da Etapa Atual */}
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <span className="stage-pill" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <ActivityIcon size={14} style={{ color: "var(--primary)" }} /> {getStageDescription(activeJob.status)}
              </span>

              <div className="row" style={{ gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  onClick={() => setShowTerminal(!showTerminal)}
                  title="Exibir ou recolher saída do terminal PowerShell"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                >
                  {showTerminal ? (
                    <>
                      <ChevronUp size={14} /> Recolher Terminal
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Mostrar Terminal
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger-outline"
                  onClick={() => handleCancel(activeJob.id)}
                  disabled={cancelingId === activeJob.id}
                  title="Interromper processamento"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <X size={14} />
                  <span>{cancelingId === activeJob.id ? "Cancelando…" : "Cancelar Processo"}</span>
                </button>
              </div>
            </div>

            {/* Console de Logs Estilo Terminal */}
            {showTerminal && (
              <div style={{ marginTop: "0.4rem" }}>
                <PowerShellTerminal
                  logs={activeJob.logs ?? []}
                  status={activeJob.status}
                  jobId={activeJob.id}
                />
              </div>
            )}
          </div>
        )}

        {/* GALERIA DE PROJETOS E CLIPES (CRUD) */}
        <section className="stack">
          <div className="row">
            <h2>Galeria de Projetos &amp; Clipes</h2>
            <span className="muted small">{jobs.length} projeto(s)</span>
          </div>

          {jobs.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <Film size={44} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 0.75rem", opacity: 0.6 }} />
              <h3 style={{ color: "var(--text)", marginBottom: "0.35rem" }}>Nenhum projeto criado ainda</h3>
              <p className="muted small" style={{ maxWidth: "380px", margin: "0 auto" }}>
                Cole um link do YouTube ou envie um vídeo no formulário ao lado para a IA começar a extrair os melhores cortes virais.
              </p>
            </div>
          )}

          {jobs.map((job) => {
            const vertical = job.orientation === "vertical";
            const jobClips = job.clips ?? [];

            return (
              <article key={job.id} className="card stack" style={{ padding: "1.25rem" }}>
                {/* Cabeçalho do Projeto */}
                <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div className="row" style={{ justifyContent: "flex-start", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <StatusBadge status={job.status} />
                      <span className="badge-status" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--card-border)" }}>
                        {vertical ? <SmartphoneIcon size={13} /> : <MonitorIcon size={13} />}
                        {vertical ? "Vertical (9:16)" : "Horizontal (16:9)"}
                      </span>
                      {job.vertical_mode === "face_tracking" && (
                        <span className="badge-status" style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1px solid rgba(79, 70, 229, 0.2)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                          <User size={12} /> Auto-Face IA
                        </span>
                      )}
                      {job.vertical_mode === "split_face" && (
                        <span className="badge-status" style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1px solid rgba(79, 70, 229, 0.2)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                          <Users size={12} /> Podcast IA
                        </span>
                      )}
                      <span className="muted small">· {fmtDate(job.created_at)}</span>
                    </div>
                    <h3 className="ellipsis" style={{ fontSize: "1.1rem" }}>
                      <Link href={`/jobs/${job.id}`} style={{ color: "inherit", textDecoration: "none" }} className="hover-link">
                        {jobTitle(job)}
                      </Link>
                    </h3>
                  </div>

                  <div className="row" style={{ gap: "0.5rem" }}>
                    <Link className="btn-secondary" href={`/jobs/${job.id}`} style={{ fontSize: "0.84rem", padding: "0.45rem 0.85rem", textDecoration: "none" }}>
                      Ver detalhes
                    </Link>
                    <button
                      type="button"
                      className="btn-danger-outline"
                      onClick={() => handleDelete(job.id)}
                      disabled={deletingId === job.id}
                      title="Excluir este projeto e todos os clipes"
                    >
                      <TrashIcon size={14} />
                      <span>{deletingId === job.id ? "Excluindo…" : "Excluir"}</span>
                    </button>
                  </div>
                </div>

                {/* Status em andamento na listagem */}
                {!isFinal(job.status) && (
                  <div className="stack" style={{ gap: "0.4rem", marginTop: "0.4rem" }}>
                    <div className="row">
                      <small className="muted">{getStageDescription(job.status)}</small>
                      <small><strong>{job.progress}%</strong></small>
                    </div>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${job.progress}%` }} />
                    </div>
                  </div>
                )}

                {job.status === "failed" && (
                  <p className="error" style={{ margin: "0.3rem 0", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <AlertCircleIcon size={14} /> {job.error ?? "Ocorreu uma falha durante o processamento."}
                  </p>
                )}

                {job.status === "canceled" && (
                  <p className="muted" style={{ color: "var(--warning)", margin: "0.3rem 0", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <AlertTriangle size={14} /> Processamento cancelado pelo usuário.
                  </p>
                )}

                {/* Grade de Clipes (.clips-grid) com Player HTML5, Badge Viral e Download */}
                {job.status === "done" && jobClips.length > 0 && (
                  <div className="stack" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--card-border)", paddingTop: "1rem" }}>
                    <div className="row">
                      <strong style={{ fontSize: "0.95rem", color: "var(--text)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <SparklesIcon size={16} style={{ color: "var(--primary)" }} />
                        {jobClips.length} Clipes Gerados pela IA
                      </strong>
                    </div>

                    <div className="clips-grid">
                      {jobClips.map((clip) => {
                        const videoSrc = clip.file_path ? urls[clip.file_path] : undefined;
                        const durationSec = Math.round(Number(clip.end_seconds) - Number(clip.start_seconds));

                        return (
                          <div key={clip.id} className="clip-card">
                            {/* Player HTML5 */}
                            {videoSrc ? (
                              <video
                                src={videoSrc}
                                controls
                                preload="metadata"
                                className={vertical ? "vid vertical" : "vid"}
                              />
                            ) : (
                              <div className={vertical ? "vid vertical placeholder" : "vid placeholder"}>
                                Carregando player…
                              </div>
                            )}

                            {/* Informações e Badge de Viralidade */}
                            <div className="row" style={{ marginTop: "0.2rem" }}>
                              <span className="badge-viral">
                                <TrendingUpIcon size={14} />
                                {clip.score ?? 95}/100
                              </span>
                              <span className="muted small">
                                {fmtClock(clip.start_seconds)}–{fmtClock(clip.end_seconds)} ({durationSec}s)
                              </span>
                            </div>

                            {/* Título do Corte */}
                            <h4 style={{ fontSize: "1rem", lineHeight: 1.35, margin: 0, fontWeight: 700 }}>
                              {clip.position}. {clip.title}
                            </h4>

                            {/* Gancho Forte (Hook) */}
                            {clip.hook && (
                              <p className="clip-hook" title="Gancho inicial forte detectado pela IA">
                                <strong>Gancho:</strong> &ldquo;{clip.hook}&rdquo;
                              </p>
                            )}

                            {/* Justificativa / Por que é viral (Claude AI) */}
                            {clip.reason && (
                              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                                <strong>Por que viraliza:</strong> {clip.reason}
                              </p>
                            )}

                            {/* Botões de Ação do Corte */}
                            <div className="row" style={{ marginTop: "auto", gap: "0.5rem" }}>
                              <button
                                type="button"
                                className="btn-cta"
                                style={{ flex: 1, padding: "0.6rem 0.85rem", fontSize: "0.85rem" }}
                                onClick={() => download(clip)}
                                disabled={downloadingId === clip.id}
                              >
                                <DownloadIcon size={16} />
                                <span>{downloadingId === clip.id ? "Preparando…" : "Baixar MP4"}</span>
                              </button>
                              <button
                                type="button"
                                className="btn-danger-outline"
                                style={{ padding: "0.6rem 0.75rem", fontSize: "0.85rem" }}
                                onClick={() => handleDeleteClip(clip.id, job.id)}
                                disabled={deletingClipId === clip.id}
                                title="Excluir este clipe permanentemente"
                              >
                                <TrashIcon size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </section>
    </div>
    </div>
  );
}
