"use client";

import React, { useEffect } from "react";
import CopyStyleStudio from "./CopyStyleStudio";

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
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "820px",
          maxHeight: "86vh",
          background: "var(--card-bg, #FFFFFF)",
          border: "1px solid var(--card-border, #E2E8F0)",
          borderRadius: "16px",
          boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.15), 0 8px 16px -6px rgba(0, 0, 0, 0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corpo com Scroll Ajustado */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem 1.5rem",
            backgroundColor: "var(--card-bg, #FFFFFF)",
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
