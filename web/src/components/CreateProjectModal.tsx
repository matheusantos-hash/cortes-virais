"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "@/app/actions";
import { FolderPlus, X, Sparkles, Check, Palette } from "./Icons";

interface CreateProjectModalProps {
  isOpen: boolean;
  userId?: string;
  onClose: () => void;
  onCreated: (newProject: any) => void;
}

const COLOR_OPTIONS = [
  { hex: "#8B5CF6", name: "Roxo Studio" },
  { hex: "#3B82F6", name: "Azul Neon" },
  { hex: "#EC4899", name: "Rosa Viral" },
  { hex: "#10B981", name: "Verde Retenção" },
  { hex: "#F59E0B", name: "Âmbar / Ouro" },
  { hex: "#06B6D4", name: "Ciano Elétrico" },
];

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colorTag, setColorTag] = useState("#8B5CF6");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Por favor, informe o nome do projeto.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await createProjectAction(name.trim(), description.trim(), colorTag);
      if (!res.success || !res.project) {
        setError(res.error || "Não foi possível criar o projeto.");
        setBusy(false);
        return;
      }

      onCreated(res.project);
      setName("");
      setDescription("");
      onClose();
      router.push(`/projetos/${res.project.id}`);
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao criar projeto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10, 15, 29, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "1.5rem",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "rgba(139, 92, 246, 0.15)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FolderPlus size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Criar Novo Projeto</h3>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                Organize seus cortes e clipes em uma pasta dedicada estilo CapCut
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: "0.85rem" }}>
          {error && (
            <div className="card-subtle" style={{ color: "var(--danger)", padding: "0.6rem 0.8rem", fontSize: "0.82rem" }}>
              {error}
            </div>
          )}

          <div>
            <label className="field-label" style={{ marginBottom: "0.3rem" }}>
              Nome do Projeto:
            </label>
            <input
              type="text"
              className="input"
              placeholder="Ex: Podcast Flow #300, Vlog Viagem Japão, Canal Dark..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              style={{ width: "100%", fontSize: "0.95rem" }}
            />
          </div>

          <div>
            <label className="field-label" style={{ marginBottom: "0.3rem" }}>
              Descrição / Objetivo (Opcional):
            </label>
            <textarea
              className="input"
              rows={2}
              placeholder="Ex: Focar nos melhores momentos com ganchos rápidos e legendas brancas."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", resize: "vertical", fontSize: "0.85rem" }}
            />
          </div>

          <div>
            <label className="field-label" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "0.5rem" }}>
              <Palette size={14} style={{ color: "var(--primary)" }} />
              <strong>Etiqueta de Cor do Projeto:</strong>
            </label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", padding: "4px 2px" }}>
              {COLOR_OPTIONS.map((col) => {
                const isSelected = colorTag === col.hex;
                return (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => setColorTag(col.hex)}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: col.hex,
                      border: isSelected ? "2px solid #ffffff" : "2px solid rgba(255, 255, 255, 0.15)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: isSelected
                        ? `0 0 0 2px var(--background, #0f172a), 0 0 0 4px ${col.hex}, 0 4px 12px ${col.hex}66`
                        : "0 2px 5px rgba(0, 0, 0, 0.25)",
                      transform: isSelected ? "scale(1.08)" : "scale(1)",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    title={`${col.name} (${col.hex})`}
                    aria-label={col.name}
                  >
                    {isSelected && (
                      <Check
                        size={16}
                        strokeWidth={3}
                        color="#ffffff"
                        style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !name.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Check size={16} />
              <span>{busy ? "Criando…" : "Criar Projeto"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
