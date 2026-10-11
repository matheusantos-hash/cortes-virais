"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelJob, deleteUserClip, requestClipTrimAction, saveClipCanvasBrollsAction } from "@/app/actions";
import { fmtClock, isFinal, jobTitle } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { getSignedUrlsCached } from "@/lib/signedUrlCache";
import type { Clip, Job } from "@/lib/types";
import PowerShellTerminal from "./PowerShellTerminal";
import dynamic from "next/dynamic";
import StatusBadge from "./StatusBadge";
const ClipEditorModal = dynamic(() => import("./ClipEditorModal"), { ssr: false });
import ClipCard from "./ClipCard";
import BatchExportModal from "./BatchExportModal";
import CustomVideoPlayer from "./CustomVideoPlayer";
import {
  DownloadIcon,
  TrashIcon,
  TrendingUpIcon,
  SmartphoneIcon,
  MonitorIcon,
  XIcon,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  User,
  Users,
  Layers,
  Columns,
  Film,
  FileCode,
  Subtitles,
  Clock,
  Pencil,
  FolderKanban,
  Check,
} from "./Icons";

export default function JobView({ initialJob, initialClips }: { initialJob: Job; initialClips: Clip[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [job, setJob] = useState<Job>(initialJob);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [isBatchExportModalOpen, setIsBatchExportModalOpen] = useState(false);

  const toggleSelectClip = (clipId: string) => {
    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  const selectAllClips = () => {
    if (selectedClipIds.size === clips.length) {
      setSelectedClipIds(new Set());
    } else {
      setSelectedClipIds(new Set(clips.map((c) => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedClipIds(new Set());
  };

  const activeSelectedClips = useMemo(() => {
    return clips.filter((c) => selectedClipIds.has(c.id));
  }, [clips, selectedClipIds]);

  const refresh = useCallback(async () => {
    const { data: j } = await supabase.from("jobs").select("*").eq("id", initialJob.id).single();
    if (!j) return;
    setJob(j as Job);
    if (j.status === "done") {
      const { data: c } = await supabase.from("clips").select("*").eq("job_id", initialJob.id).order("position");
      if (c) setClips(c as Clip[]);
    }
  }, [supabase, initialJob.id]);

  // Realtime subscription para receber novos logs e atualizações de status instantaneamente
  useEffect(() => {
    const jobChannel = supabase
      .channel(`job-detail-${initialJob.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${initialJob.id}` }, (payload) => {
        if (payload.new) {
          setJob(payload.new as Job);
          if ((payload.new as Job).status === "done") {
            refresh();
          }
        }
      })
      .subscribe();

    const clipsChannel = supabase
      .channel(`clips-detail-${initialJob.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clips", filter: `job_id=eq.${initialJob.id}` }, () => {
        refresh();
      })
      .subscribe();

    const logsBroadcastChannel = supabase
      .channel(`job-logs-${initialJob.id}`)
      .on("broadcast", { event: "new_log" }, (payload: any) => {
        if (payload?.payload?.log) {
          setJob((prev) => {
            const currentLogs = prev.logs || [];
            if (currentLogs[currentLogs.length - 1] === payload.payload.log) return prev;
            return {
              ...prev,
              logs: [...currentLogs.slice(-199), payload.payload.log],
            };
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(clipsChannel);
      supabase.removeChannel(logsBroadcastChannel);
    };
  }, [supabase, initialJob.id, refresh]);

  useEffect(() => {
    if (isFinal(job.status)) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [job.status, refresh]);

  async function handleCancel() {
    if (!confirm("Tem certeza que deseja cancelar o processamento deste vídeo?")) return;
    setCanceling(true);
    try {
      const res = await cancelJob(job.id);
      if (res && !res.success && res.error) {
        alert(`Não foi possível cancelar: ${res.error}`);
        return;
      }
      setJob((prev) => ({
        ...prev,
        status: "canceled",
        error: "Cancelado pelo usuário.",
      }));
      await refresh();
    } catch (err: any) {
      console.error("Falha ao cancelar:", err);
      alert(`Erro inesperado ao cancelar: ${err?.message || "Tente novamente."}`);
    } finally {
      setCanceling(false);
    }
  }

  async function handleDeleteClip(clipId: string) {
    if (!confirm("Tem certeza que deseja apagar permanentemente este clipe? O arquivo será removido do armazenamento.")) return;
    setDeletingClipId(clipId);
    try {
      const res = await deleteUserClip(clipId);
      if (res && !res.success && res.error) {
        alert(`Não foi possível excluir o clipe: ${res.error}`);
        return;
      }
      setClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch (err: any) {
      console.error("Falha ao excluir clipe:", err);
      alert(`Erro inesperado ao excluir clipe: ${err?.message || "Tente novamente."}`);
    } finally {
      setDeletingClipId(null);
    }
  }

  // Links temporários para reproduzir os clipes (com cache em memória/sessão)
  useEffect(() => {
    const paths: string[] = [];
    clips.forEach((c) => {
      if (c.thumbnail_url && !urls[c.thumbnail_url] && !paths.includes(c.thumbnail_url)) {
        paths.push(c.thumbnail_url);
      }
      if (c.file_path && !urls[c.file_path] && !paths.includes(c.file_path)) {
        paths.push(c.file_path);
      }
    });

    if (!paths.length) return;

    getSignedUrlsCached(supabase, "clips", paths).then((signedMap) => {
      setUrls((prev) => ({ ...prev, ...signedMap }));
    });
  }, [clips, supabase, urls]);

  // Pausar todos os vídeos em reprodução ao abrir o editor
  const handleOpenEditor = (clip: Clip) => {
    document.querySelectorAll("video").forEach((v) => {
      try {
        v.pause();
      } catch {}
    });
    setEditingClip(clip);
  };

  // Garante que nenhum vídeo de preview continue tocando enquanto o modal estiver aberto
  useEffect(() => {
    if (editingClip) {
      document.querySelectorAll("video").forEach((v) => {
        if (!v.closest(".clip-editor-modal") && !v.closest("[data-editor-modal]")) {
          try {
            v.pause();
          } catch {}
        }
      });
    }
  }, [editingClip]);

  async function download(clip: Clip) {
    if (!clip.file_path) return;
    setDownloading(clip.id);
    const ext = clip.file_path.endsWith(".mov") ? "mov" : "mp4";
    const name = `corte-${String(clip.position).padStart(2, "0")}.${ext}`;
    const { data, error } = await supabase.storage.from("clips").createSignedUrl(clip.file_path, 300, { download: name });
    setDownloading(null);
    if (error || !data?.signedUrl) {
      alert("Não foi possível gerar link de download para este clipe. Verifique sua conexão ou tente novamente.");
      return;
    }
    window.location.href = data.signedUrl;
  }

  const vertical = job.orientation === "vertical";

  return (
    <div className="stack-lg" style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div className="row">
        <Link href="/" className="btn btn-small btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <ArrowLeft size={14} /> Voltar ao Painel
        </Link>
        <span className="muted small">ID: {job.id}</span>
      </div>

      <div className="card stack">
        <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div className="row" style={{ justifyContent: "flex-start", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <StatusBadge status={job.status} />
              <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                {vertical ? <SmartphoneIcon size={13} /> : <MonitorIcon size={13} />}
                {vertical ? "9:16 Vertical" : "16:9 Horizontal"}
              </span>
              <span className="muted small">{clips.length > 0 ? `${clips.length} clipes` : ""}</span>
            </div>
            <h1 className="ellipsis" style={{ fontSize: "1.4rem", margin: 0 }}>{jobTitle(job)}</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {job.project_id && (
              <Link
                href={`/projetos/${job.project_id}`}
                className="btn btn-secondary btn-small"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", textDecoration: "none" }}
              >
                <FolderKanban size={14} style={{ color: "var(--primary)" }} />
                <span>Abrir no Workspace do Projeto</span>
              </Link>
            )}

            {!isFinal(job.status) && (
              <button
                type="button"
                className="btn btn-small btn-danger-outline"
                onClick={handleCancel}
                disabled={canceling}
                title="Interromper e cancelar o processamento deste vídeo"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
              >
                <XIcon size={14} />
                <span>{canceling ? "Cancelando…" : "Cancelar Processo"}</span>
              </button>
            )}
          </div>
        </div>

        {!isFinal(job.status) && (
          <div className="bar">
            <div className="bar-fill" style={{ width: `${Math.max(job.progress, 5)}%` }} />
          </div>
        )}

        {job.status === "failed" && (
          <p className="error" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <AlertCircle size={15} /> {job.error ?? "Falha ao processar o vídeo."}
          </p>
        )}
        {job.status === "canceled" && (
          <p className="muted" style={{ color: "var(--warning)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <AlertTriangle size={15} /> Processamento cancelado pelo usuário.
          </p>
        )}

        {/* Informações de Design e Referência */}
        {(job.reference_style || job.reference_url || job.design_instructions || job.vertical_mode) && (
          <div className="card" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", fontSize: "0.88rem", padding: "0.75rem 1rem" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              {job.vertical_mode && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  <strong>Layout:</strong>{" "}
                  {job.vertical_mode === "grupo" ? (
                    <><Users size={13} /> Grupo IA (Foco no Orador)</>
                  ) : job.vertical_mode === "face_tracking" ? (
                    <><User size={13} /> Auto-Face (IA)</>
                  ) : job.vertical_mode === "split_face" ? (
                    <><Users size={13} /> Podcast IA (Split Rostos)</>
                  ) : job.vertical_mode === "crop" ? (
                    <><SmartphoneIcon size={13} /> Crop 9:16</>
                  ) : job.vertical_mode === "blur" ? (
                    <><Layers size={13} /> Fundo Blur</>
                  ) : job.vertical_mode === "split" ? (
                    <><Columns size={13} /> Split Screen</>
                  ) : (
                    job.vertical_mode
                  )}
                </span>
              )}
              {job.reference_style && (
                <span>
                  <strong>Estilo:</strong> {job.reference_style}
                </span>
              )}
            </div>
            {job.reference_url && (
              <div style={{ marginTop: "0.3rem" }}>
                <strong>Vídeo de Referência:</strong>{" "}
                <a href={job.reference_url} target="_blank" rel="noopener noreferrer" className="link" style={{ wordBreak: "break-all" }}>
                  {job.reference_url}
                </a>
              </div>
            )}
            {job.design_instructions && (
              <div style={{ marginTop: "0.3rem", color: "var(--text-muted)" }}>
                <strong>Diretrizes:</strong> “{job.design_instructions}”
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal PowerShell do Backend */}
      <section className="stack">
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600 }}>Andamento do Processo (Terminal ao Vivo)</h2>
        <PowerShellTerminal logs={job.logs ?? []} status={job.status} jobId={job.id} />
      </section>

      {/* Grade de Clipes Gerados */}
      {job.status === "done" && (
        <section className="stack">
          <div className="row" style={{ flexWrap: "wrap", gap: "0.75rem", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <h2>Clipes Gerados pela IA ({clips.length})</h2>
              {clips.length > 0 && (
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  onClick={selectAllClips}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.78rem" }}
                  title="Marcar ou desmarcar todos os clipes"
                >
                  <input
                    type="checkbox"
                    checked={selectedClipIds.size === clips.length && clips.length > 0}
                    onChange={selectAllClips}
                    style={{ pointerEvents: "none", accentColor: "var(--primary, #8b5cf6)" }}
                  />
                  <span>
                    {selectedClipIds.size === clips.length
                      ? "Desmarcar Todos"
                      : `Selecionar Todos (${clips.length})`}
                  </span>
                </button>
              )}
            </div>

            {/* Menu de Exportação NLE Profissional & CapCut */}
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  if (selectedClipIds.size === 0) {
                    setSelectedClipIds(new Set(clips.map((c) => c.id)));
                  }
                  setIsBatchExportModalOpen(true);
                }}
                style={{
                  background: "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)",
                  color: "#fff",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
                title="Exportar clipes em lote com opções de vídeos MP4 finalizados ou projetos editáveis para CapCut Desktop"
              >
                <DownloadIcon size={14} /> Exportação em Lote / CapCut
              </button>

              <a
                href={`/api/jobs/${job.id}/export?format=xml`}
                download
                className="btn btn-small btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                title="Exportar projeto XML (FCP7) compatível com Adobe Premiere Pro e DaVinci Resolve com preservação da timeline e cortes"
              >
                <Film size={14} /> XML (Premiere / Resolve)
              </a>

              <a
                href={`/api/jobs/${job.id}/export?format=srt`}
                download
                className="btn btn-small btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                title="Baixar legendas em formato SRT sincronizado para todos os clipes"
              >
                <Subtitles size={14} /> Legendas SRT
              </a>
            </div>
          </div>

          <div className="clips-grid">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                videoSrc={clip.file_path ? urls[clip.file_path] : undefined}
                posterSrc={clip.thumbnail_url ? urls[clip.thumbnail_url] : undefined}
                vertical={vertical}
                jobId={job.id}
                orientation={job.orientation}
                verticalMode={job.vertical_mode}
                selectable={true}
                selected={selectedClipIds.has(clip.id)}
                onToggleSelect={toggleSelectClip}
                onEdit={handleOpenEditor}
                onDownload={download}
                onDelete={handleDeleteClip}
                isDownloading={downloading === clip.id}
                isDeleting={deletingClipId === clip.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Barra Flutuante de Ações em Massa (Bulk Actions Toolbar) */}
      {activeSelectedClips.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9000,
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--primary, #8b5cf6)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(139, 92, 246, 0.3)",
            borderRadius: "50px",
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#fff", whiteSpace: "nowrap" }}>
            {activeSelectedClips.length} {activeSelectedClips.length === 1 ? "corte selecionado" : "cortes selecionados"}
          </span>
          <button
            type="button"
            className="btn btn-cta btn-small"
            onClick={() => setIsBatchExportModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "20px" }}
          >
            <DownloadIcon size={14} />
            Exportar Selecionados
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={clearSelection}
            style={{ borderRadius: "20px" }}
          >
            Limpar
          </button>
        </div>
      )}

      {/* Modal de Exportação em Lote */}
      <BatchExportModal
        isOpen={isBatchExportModalOpen}
        onClose={() => setIsBatchExportModalOpen(false)}
        job={job}
        selectedClips={activeSelectedClips.length > 0 ? activeSelectedClips : clips}
        signedUrls={urls}
      />

      {/* Modal Interativo de Trimming & Gerador de Capas & B-Rolls Canvas */}
      {editingClip && (
        <ClipEditorModal
          clip={editingClip}
          videoSrc={editingClip.file_path ? urls[editingClip.file_path] : undefined}
          userId={job.user_id}
          projectId={job.project_id || undefined}
          initialAspectRatio={
            editingClip.edit_decisions?.orientation === "horizontal" || job.orientation === "horizontal"
              ? "16:9"
              : "9:16"
          }
          onClose={() => setEditingClip(null)}
          onUpdateClipTime={async (clipId, trimStart, trimEnd, canvasBrolls, adjustments) => {
            const res = await requestClipTrimAction(clipId, trimStart, trimEnd, canvasBrolls, adjustments);
            if (!res.success) {
              alert(`Falha ao iniciar recorte: ${res.error}`);
              return;
            }
            setClips((prev) =>
              prev.map((c) => (c.id === clipId ? { ...c, is_trimming: true, canvas_brolls: canvasBrolls ?? c.canvas_brolls } : c))
            );
            alert("Ajuste solicitado com sucesso! O worker está re-renderizando seu corte em alta definição...");
          }}
          onSaveCanvasBrolls={async (clipId, brolls) => {
            const res = await saveClipCanvasBrollsAction(clipId, brolls);
            if (!res.success) {
              throw new Error(res.error || "Falha ao salvar");
            }
            setClips((prev) =>
              prev.map((c) => (c.id === clipId ? { ...c, canvas_brolls: brolls } : c))
            );
          }}
        />
      )}
    </div>
  );
}
