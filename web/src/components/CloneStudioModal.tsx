"use client";

import React, { useEffect } from "react";
import CopyStyleStudio from "./CopyStyleStudio";
import { SparklesIcon, XIcon, FilmIcon } from "./Icons";

export interface CloneStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  projectId?: string;
  initialClip?: {
    id: string;
    title: string;
    path?: string | null;
    url?: string;
    position?: number;
    orientation?: string;
    verticalMode?: string;
  } | null;
  onCreated?: () => void;
}

export default function CloneStudioModal({
  isOpen,
  onClose,
  userId,
  projectId,
  initialClip,
  onCreated,
}: CloneStudioModalProps) {
  // Fechar no teclado ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em um input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(5, 7, 14, 0.88)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "1180px",
          height: "90vh",
          maxHeight: "92vh",
          background: "#0E111C",
          border: "1px solid rgba(168, 85, 247, 0.38)",
          borderRadius: "16px",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.9), 0 0 45px rgba(168, 85, 247, 0.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Fixo do Modal de Clonagem */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.4rem",
            background: "#121625",
            borderBottom: "1px solid #23283D",
            flexShrink: 0,
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #7C3AED, #9333EA)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFF",
                boxShadow: "0 4px 14px rgba(168, 85, 247, 0.45)",
                flexShrink: 0,
              }}
            >
              <SparklesIcon size={20} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "#FFFFFF" }}>
                  Estúdio de Clonagem de Edição IA
                </h2>
                <span className="badge badge-accent" style={{ fontSize: "0.68rem", padding: "2px 8px" }}>
                  Clone Engine
                </span>
              </div>
              <p className="muted small" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                {initialClip ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <FilmIcon size={12} style={{ color: "#C084FC" }} />
                    Aplicando estilo e DNA de edição ao corte: <strong style={{ color: "#FFF" }}>{initialClip.title}</strong>
                  </span>
                ) : (
                  "Replique o DNA de canais de sucesso (ritmo, legendas e cortes) com o sistema inteligente de clonagem"
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-small"
            style={{
              background: "#1A1F30",
              border: "1px solid #2C344E",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "0.45rem 0.75rem",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 600,
              fontSize: "0.82rem",
              transition: "all 0.15s ease",
            }}
            title="Fechar Modal de Clonagem"
          >
            <XIcon size={16} /> Fechar
          </button>
        </div>

        {/* Corpo com Scroll Ajustado */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem 1.5rem",
            backgroundColor: "#0A0C14",
          }}
        >
          <CopyStyleStudio
            userId={userId}
            projectId={projectId}
            initialClip={initialClip}
            isModal={true}
            onCreated={() => {
              if (onCreated) onCreated();
              onClose();
            }}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
