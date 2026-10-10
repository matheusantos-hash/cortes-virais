"use client";

import React from "react";
import type { Clip } from "@/lib/types";
import { fmtClock } from "@/lib/format";
import CustomVideoPlayer from "./CustomVideoPlayer";
import {
  TrendingUpIcon,
  DownloadIcon,
  TrashIcon,
  Clock,
  Pencil,
  Subtitles,
} from "./Icons";

export interface ClipCardProps {
  clip: Clip;
  videoSrc?: string;
  posterSrc?: string;
  vertical?: boolean;
  jobId?: string;
  orientation?: "vertical" | "horizontal";
  verticalMode?: string;
  onEdit?: (clip: Clip) => void;
  onDownload?: (clip: Clip) => void;
  onDelete?: (clipId: string) => void;
  isDownloading?: boolean;
  isDeleting?: boolean;
}

export default function ClipCard({
  clip,
  videoSrc,
  posterSrc,
  vertical = true,
  jobId,
  orientation,
  verticalMode,
  onEdit,
  onDownload,
  onDelete,
  isDownloading = false,
  isDeleting = false,
}: ClipCardProps) {
  const durationSec = Math.round(Number(clip.end_seconds) - Number(clip.start_seconds));

  const handleClone = () => {
    const clipData = {
      id: clip.id,
      title: clip.title,
      path: clip.file_path,
      url: videoSrc,
      position: clip.position,
      orientation: orientation || (vertical ? "vertical" : "horizontal"),
      verticalMode: verticalMode,
    };
    try {
      sessionStorage.setItem("clone_source_clip", JSON.stringify(clipData));
    } catch {}
    window.location.href = "/?mode=copiar_estilo&fromClip=1";
  };

  return (
    <div className="clip-card" style={{ display: "flex", flexDirection: "column" }}>
      {videoSrc ? (
        <CustomVideoPlayer
          src={videoSrc}
          poster={posterSrc}
          playsInline
          preload={posterSrc ? "none" : "metadata"}
          aspectRatio={vertical ? "9/16" : "16/9"}
          downloadFileName={`${clip.title || "clipe"}.mp4`}
          style={{ width: "100%", maxHeight: "480px" }}
        />
      ) : (
        <div className={vertical ? "vid vertical placeholder" : "vid placeholder"}>
          Carregando vídeo…
        </div>
      )}

      {/* Badges de Destaque */}
      <div className="row" style={{ marginTop: "0.4rem", flexWrap: "wrap", gap: "0.4rem" }}>
        <span className="badge-viral">
          <TrendingUpIcon size={14} />
          {clip.score ?? 95}/100
        </span>
        <span className="muted small">
          {fmtClock(clip.start_seconds)}–{fmtClock(clip.end_seconds)} ({durationSec}s)
        </span>
        {clip.is_trimming && (
          <span
            className="badge"
            style={{
              background: "rgba(245, 158, 11, 0.15)",
              color: "#f59e0b",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              fontSize: "0.75rem",
              padding: "0.15rem 0.5rem",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Clock size={12} /> Re-renderizando corte...
          </span>
        )}
      </div>

      {/* Título e Textos Explicativos */}
      <h4 style={{ fontSize: "1rem", lineHeight: 1.35, margin: "0.4rem 0 0.2rem 0", fontWeight: 700 }}>
        {clip.position}. {clip.title}
      </h4>

      {clip.hook && (
        <p className="clip-hook" title="Gancho inicial forte detectado pela IA" style={{ margin: "0.2rem 0" }}>
          <strong>Gancho:</strong> &ldquo;{clip.hook}&rdquo;
        </p>
      )}

      {clip.reason && (
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0.2rem 0", lineHeight: 1.4 }}>
          <strong>Por que viraliza:</strong> {clip.reason}
        </p>
      )}

      {clip.visual_context && (
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--primary)",
            margin: "0.2rem 0",
            lineHeight: 1.35,
          }}
        >
          <span>
            <strong>Impacto visual:</strong> {clip.visual_context}
          </span>
        </p>
      )}

      {/* Barra de Ações do Clipe */}
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "auto", paddingTop: "0.75rem", flexWrap: "wrap" }}>
        {onEdit && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              flex: 1,
              minWidth: "85px",
              padding: "0.55rem 0.4rem",
              fontSize: "0.82rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.3rem",
            }}
            onClick={() => onEdit(clip)}
            title="Ajustar tempo de corte no CapCut Studio e criar capa personalizada"
          >
            <Pencil size={13} /> Editar
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary"
          style={{
            padding: "0.55rem 0.5rem",
            fontSize: "0.82rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            border: "1px solid rgba(0, 240, 255, 0.4)",
            color: "var(--accent-cyan, #00F0FF)",
          }}
          onClick={handleClone}
          title="Enviar este corte para o Clone Studio (aplicar estilo e ritmo de referência com IA)"
        >
          Clonar
        </button>

        {jobId && (
          <a
            href={`/api/jobs/${jobId}/export?format=srt&clipId=${clip.id}`}
            download
            className="btn btn-secondary"
            style={{
              padding: "0.55rem 0.5rem",
              fontSize: "0.82rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
            title="Baixar legenda SRT sincronizada deste clipe específico"
          >
            <Subtitles size={13} /> SRT
          </a>
        )}

        {onDownload && (
          <button
            type="button"
            className="btn-cta"
            style={{ flex: 1, minWidth: "85px", padding: "0.55rem 0.4rem", fontSize: "0.82rem" }}
            onClick={() => onDownload(clip)}
            disabled={isDownloading}
          >
            <DownloadIcon size={15} />
            <span>{isDownloading ? "…" : "Baixar"}</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: "0.55rem 0.6rem",
              fontSize: "0.82rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--danger)",
            }}
            onClick={() => onDelete(clip.id)}
            disabled={isDeleting}
            title="Excluir este corte permanentemente"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
