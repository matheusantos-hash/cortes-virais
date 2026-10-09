"use client";

import React from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Film, Sparkles, Trash2, ArrowRight, Video, Scissors } from "./Icons";

interface ProjectCardProps {
  project: Project;
  clipsCount: number;
  thumbnailUrl?: string | null;
  onDelete?: (id: string) => void;
}

export default function ProjectCard({
  project,
  clipsCount,
  thumbnailUrl,
  onDelete,
}: ProjectCardProps) {
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
      {/* Capa do Projeto (Thumbnail ou Gradiente Elegante) */}
      <Link
        href={`/projetos/${project.id}`}
        style={{
          display: "block",
          position: "relative",
          width: "100%",
          paddingTop: "56.25%", // 16:9 aspecto
          background: project.color_tag
            ? `linear-gradient(135deg, ${project.color_tag}22 0%, #0B0E17 100%)`
            : "linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)",
          overflow: "hidden",
          textDecoration: "none",
        }}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={project.name}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: project.color_tag || "var(--primary)",
              }}
            >
              <Film size={22} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
              CapCut Workspace
            </span>
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
