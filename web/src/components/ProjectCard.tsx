"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import type { Project, Job } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Film, Sparkles, Trash2, ArrowRight, Video, Scissors, Play } from "./Icons";

interface ProjectCardProps {
  project: Project;
  clipsCount: number;
  thumbnailUrl?: string | null;
  activeJob?: Job;
  onDelete?: (id: string) => void;
}

export default function ProjectCard({
  project,
  clipsCount,
  thumbnailUrl,
  activeJob,
  onDelete,
}: ProjectCardProps) {
  const [mediaError, setMediaError] = useState(false);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = Boolean(
    thumbnailUrl &&
    (thumbnailUrl.includes(".mp4") || thumbnailUrl.includes("/clips/") || thumbnailUrl.includes("video"))
  );

  // Manipulador quando metadados do vídeo carregam: busca o segundo 1.0 para exibir frame nítido com imagem
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    try {
      const seekTime = vid.duration > 2 ? 1.0 : Math.max(0.2, (vid.duration || 1) / 2);
      vid.currentTime = seekTime;
    } catch {
      setIsFrameReady(true);
    }
  };

  // Quando o seek é concluído, o navegador decodificou o frame
  const handleSeeked = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsFrameReady(true);
    const vid = e.currentTarget;
    try {
      if (vid.videoWidth && vid.videoHeight && !posterUrl) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(vid.videoWidth, 480);
        canvas.height = Math.round((canvas.width * vid.videoHeight) / vid.videoWidth);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL("image/jpeg", 0.85);
          if (data && data.startsWith("data:image")) {
            setPosterUrl(data);
          }
        }
      }
    } catch {
      // Ignora se bloqueado por CORS, a tag video renderiza normalmente o frame seekado
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current && isVideo) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current && isVideo) {
      videoRef.current.pause();
      try {
        const vid = videoRef.current;
        vid.currentTime = vid.duration > 2 ? 1.0 : Math.max(0.2, (vid.duration || 1) / 2);
      } catch {}
    }
  };

  return (
    <div
      className="project-card"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "14px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s ease",
        boxShadow: "var(--card-shadow)",
      }}
    >
      {/* Capa do Projeto (Thumbnail ou Gradiente Elegante com Prévia de Vídeo) */}
      <Link
        href={`/projetos/${project.id}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          display: "block",
          position: "relative",
          width: "100%",
          paddingTop: "56.25%", // 16:9 aspecto
          background: project.color_tag
            ? `linear-gradient(135deg, ${project.color_tag}33 0%, #0F172A 100%)`
            : "linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)",
          overflow: "hidden",
          textDecoration: "none",
        }}
      >
        {/* Camada 1: Poster Estilizado ou Imagem Extraída via Canvas */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: project.color_tag
              ? `radial-gradient(circle at 50% 40%, ${project.color_tag}28 0%, #0B0E17 100%)`
              : "radial-gradient(circle at 50% 40%, rgba(99, 102, 241, 0.25) 0%, #0B0E17 100%)",
            zIndex: 0,
          }}
        >
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: project.color_tag || "var(--primary)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                }}
              >
                <Film size={24} />
              </div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                {project.name}
              </span>
            </>
          )}
        </div>

        {/* Camada 2: Vídeo ou Imagem real */}
        {thumbnailUrl && !mediaError && (
          isVideo ? (
            <video
              ref={videoRef}
              src={thumbnailUrl}
              preload="auto"
              muted
              playsInline
              loop
              onLoadedMetadata={handleLoadedMetadata}
              onSeeked={handleSeeked}
              onError={() => setMediaError(true)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
                opacity: isFrameReady || isHovered ? 1 : 0,
                transition: "opacity 0.35s ease",
                zIndex: 1,
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt=""
              onError={() => setMediaError(true)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                zIndex: 1,
              }}
            />
          )
        )}

        {/* Badge Flutuante de Prévia em Execução (Hover) */}
        {isHovered && isVideo && isFrameReady && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(4px)",
              borderRadius: "6px",
              padding: "2px 7px",
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "#4ADE80",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              zIndex: 3,
              border: "1px solid rgba(74, 222, 128, 0.3)",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ADE80" }} />
            <span>Prévia</span>
          </div>
        )}

        {/* Badge Flutuante de Quantidade de Clipes */}
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            right: "8px",
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            borderRadius: "6px",
            padding: "2px 8px",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <Scissors size={12} style={{ color: "var(--primary)" }} />
          <span>{clipsCount} corte{clipsCount === 1 ? "" : "s"}</span>
        </div>

        {/* Badge de Processamento Ativo */}
        {activeJob && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: project.color_tag ? "24px" : "8px",
              background: "rgba(124, 58, 237, 0.9)",
              backdropFilter: "blur(4px)",
              borderRadius: "6px",
              padding: "2px 7px",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#FFFFFF",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              border: "1px solid rgba(167, 139, 250, 0.4)",
              zIndex: 2,
            }}
          >
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#4ADE80" }} />
            <span>{activeJob.progress}%</span>
          </div>
        )}

        {/* Tag de Cor Superior */}
        {project.color_tag && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: project.color_tag,
              boxShadow: `0 0 8px ${project.color_tag}`,
            }}
          />
        )}
      </Link>

      {/* Conteúdo e Informações do Projeto */}
      <div style={{ padding: "0.9rem 1rem", display: "flex", flexDirection: "column", flex: 1, gap: "0.4rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
          <h4
            style={{
              margin: 0,
              fontSize: "0.98rem",
              fontWeight: 700,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={project.name}
          >
            {project.name}
          </h4>

          {onDelete && (
            <button
              type="button"
              className="btn-icon"
              onClick={() => onDelete(project.id)}
              style={{
                color: "var(--text-muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px",
              }}
              title="Excluir projeto"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {project.description && (
          <p
            className="muted small"
            style={{
              margin: 0,
              fontSize: "0.78rem",
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {project.description}
          </p>
        )}

        {/* Barra de progresso ao vivo se este projeto estiver com corte/clonagem em andamento */}
        {activeJob && (
          <div style={{ margin: "0.2rem 0" }}>
            <div className="bar" style={{ height: "4px", margin: 0, background: "rgba(255, 255, 255, 0.1)" }}>
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(activeJob.progress, 5)}%`,
                  background: "linear-gradient(90deg, #8B5CF6, #EC4899)",
                }}
              />
            </div>
            <span style={{ fontSize: "0.68rem", color: "#c084fc", fontWeight: 600, display: "block", marginTop: "2px" }}>
              ● Processando corte/clonagem ({activeJob.progress}%)
            </span>
          </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: "0.6rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="muted small" style={{ fontSize: "0.72rem" }}>
            {fmtDate(project.created_at)}
          </span>

          {/* BOTÃO PRINCIPAL: ENTRAR NO PROJETO */}
          <Link
            href={`/projetos/${project.id}`}
            className="btn btn-primary btn-small"
            style={{
              fontSize: "0.78rem",
              padding: "0.35rem 0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            <span>Entrar no Projeto</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
