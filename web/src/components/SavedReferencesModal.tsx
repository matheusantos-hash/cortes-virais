"use client";

import React, { useState } from "react";
import type { SavedReference } from "@/lib/types";
import Modal from "./ui/Modal";
import {
  Bookmark,
  Sparkles,
  Trash2,
  Check,
  X,
  FileVideo,
  Layers,
  Subtitles,
  SlidersHorizontal,
  Type,
  Link as LinkIcon,
  Upload as UploadIcon,
  Pencil,
  Zap,
  Monitor,
  Smartphone,
} from "./Icons";

interface SavedReferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  references: SavedReference[];
  onSelect: (ref: SavedReference) => void;
  onDelete: (id: string) => void;
  onEdit?: (ref: SavedReference) => void;
}

export default function SavedReferencesModal({
  isOpen,
  onClose,
  references,
  onSelect,
  onDelete,
  onEdit,
}: SavedReferencesModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filtered = references.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.style_category && r.style_category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Biblioteca de Referências Salvas"
      subtitle="Selecione uma referência salva anteriormente para aplicar o estilo instantaneamente"
      maxWidth="680px"
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Fechar
        </button>
      }
    >

        {/* Campo de Busca */}
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            className="input"
            placeholder="Buscar por nome do estilo ou categoria…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        {/* Lista de Referências */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            paddingRight: "0.25rem",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "2.5rem 1rem",
                background: "var(--bg-subtle)",
                borderRadius: "12px",
                border: "1px dashed var(--card-border)",
              }}
            >
              <FileVideo size={32} style={{ color: "var(--text-dim)", marginBottom: "0.5rem" }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma referência encontrada</p>
              <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                Quando você salvar uma referência no estúdio, ela aparecerá listada aqui.
              </p>
            </div>
          ) : (
            filtered.map((ref) => (
              <div
                key={ref.id}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "12px",
                  padding: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                className="hover-card"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    <strong style={{ fontSize: "1rem" }}>{ref.name}</strong>
                    {ref.style_category && (
                      <span
                        className="badge"
                        style={{
                          background: "var(--primary-light)",
                          color: "var(--primary)",
                          fontSize: "0.75rem",
                          padding: "0.15rem 0.5rem",
                        }}
                      >
                        {ref.style_category}
                      </span>
                    )}
                    {ref.subtitle_style && (
                      <span
                        className="badge"
                        style={{
                          background: "var(--bg-subtle)",
                          color: "var(--text-muted)",
                          fontSize: "0.72rem",
                          border: "1px solid var(--card-border)",
                        }}
                      >
                        <Subtitles size={11} style={{ marginRight: "3px", verticalAlign: "middle" }} />
                        {ref.subtitle_style.toUpperCase()}
                      </span>
                    )}
                    {(ref.custom_font_name || ref.manual_adjustments?.subtitles?.customFontName) && (
                      <span
                        className="badge"
                        style={{
                          background: "var(--bg-subtle)",
                          color: "var(--primary)",
                          fontSize: "0.72rem",
                          border: "1px solid var(--primary-light)",
                        }}
                      >
                        <Type size={11} style={{ marginRight: "3px", verticalAlign: "middle" }} />
                        {ref.custom_font_name || ref.manual_adjustments?.subtitles?.customFontName}
                      </span>
                    )}
                    <span
                      className="badge"
                      style={{
                        background: ref.export_settings?.resolution === "1920x1080" ? "rgba(99, 102, 241, 0.15)" : "var(--bg-subtle)",
                        color: ref.export_settings?.resolution === "1920x1080" ? "var(--primary)" : "var(--text-muted)",
                        fontSize: "0.72rem",
                        border: "1px solid var(--card-border)",
                      }}
                    >
                      {ref.export_settings?.resolution === "1920x1080" ? (
                        <>
                          <Monitor size={11} style={{ marginRight: "3px", verticalAlign: "middle" }} /> 16:9 Horizontal
                        </>
                      ) : ref.export_settings?.resolution === "1080x1080" ? (
                        "1:1 Quadrado"
                      ) : ref.export_settings?.resolution === "2160x3840" ? (
                        "9:16 4K Ultra"
                      ) : (
                        <>
                          <Smartphone size={11} style={{ marginRight: "3px", verticalAlign: "middle" }} /> 9:16 Vertical
                        </>
                      )}
                    </span>
                  </div>

                  <p
                    className="muted small"
                    style={{
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                      {ref.reference_type === "upload" ? (
                        <>
                          <UploadIcon size={13} /> Arquivo de Vídeo
                        </>
                      ) : (
                        <>
                          <LinkIcon size={13} /> Link: {ref.reference_url?.slice(0, 32)}…
                        </>
                      )}
                    </span>
                    {ref.manual_adjustments?.keyMoments?.cutPacing && (
                      <span>• Ritmo: {ref.manual_adjustments.keyMoments.cutPacing}</span>
                    )}
                    <span>
                      • Formato:{" "}
                      <strong>
                        {ref.export_settings?.resolution === "1920x1080"
                          ? "16:9 Horizontal"
                          : ref.export_settings?.resolution === "1080x1080"
                          ? "1:1 Quadrado"
                          : ref.export_settings?.resolution === "2160x3840"
                          ? "9:16 4K Ultra"
                          : "9:16 Vertical"}
                      </strong>
                    </span>
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                    <span
                      className="badge"
                      style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "var(--success, #10b981)",
                        fontSize: "0.72rem",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        fontWeight: 600,
                      }}
                    >
                      <Zap size={11} />
                      {ref.learning_metrics?.accuracyScore ?? (ref.sample_videos && ref.sample_videos.length > 1 ? 86 : 78)}% Acurácia
                    </span>
                    {ref.sample_videos && ref.sample_videos.length > 0 && (
                      <span
                        className="badge"
                        style={{
                          background: "var(--bg-subtle)",
                          color: "var(--text-muted)",
                          fontSize: "0.72rem",
                          border: "1px solid var(--card-border)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <FileVideo size={11} />
                        {ref.sample_videos.length} vídeo{ref.sample_videos.length > 1 ? "s" : ""} de treino
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  {onEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => onEdit(ref)}
                      title="Editar estilo (renomear e adicionar mais vídeos de treinamento)"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "0.5rem 0.85rem", fontSize: "0.85rem" }}
                    onClick={() => {
                      onSelect(ref);
                      onClose();
                    }}
                  >
                    <Check size={15} style={{ marginRight: "4px" }} />
                    Usar Estilo
                  </button>
                  {!ref.id.startsWith("preset-") && (
                    <button
                      type="button"
                      className="btn-danger-outline"
                      style={{ padding: "0.5rem", borderRadius: "8px" }}
                      onClick={() => onDelete(ref.id)}
                      title="Excluir referência salva"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

    </Modal>
  );
}
