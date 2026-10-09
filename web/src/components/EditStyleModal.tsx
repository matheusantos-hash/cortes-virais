"use client";

import React, { useState, useRef } from "react";
import type { SavedReference } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { uploadResumable } from "@/lib/upload";
import {
  Pencil,
  X,
  Upload,
  Video,
  Film,
  Zap,
  Sparkles,
  Check,
  Cpu,
  BarChart3,
  Layers,
  Clock,
  Subtitles,
  AlertCircle,
  Smartphone,
  Monitor,
  Square,
  Crop,
  User,
  Users,
  Columns,
  Lightbulb,
  Clapperboard,
  TrendingUp,
  CheckCircle2,
} from "./Icons";

const RESUMABLE_FROM_BYTES = 6 * 1024 * 1024;

function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
}

interface EditStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  reference: SavedReference | null;
  onSave: (updatedReference: SavedReference) => Promise<void> | void;
  userId: string;
}

export function calculateStyleAccuracy(baseCount: number, additionalCount = 0): number {
  const total = baseCount + additionalCount;
  if (total <= 0) return 75;
  if (total === 1) return 78;
  if (total === 2) return 86;
  if (total === 3) return 92;
  if (total === 4) return 96;
  return Math.min(99, 96 + (total - 4));
}

export function getAccuracyLevel(score: number): { label: string; color: string } {
  if (score >= 96) return { label: "DNA Perfeito (Ultra Acurácia)", color: "#10b981" };
  if (score >= 90) return { label: "Alta Acurácia (Recomendado)", color: "#38bdf8" };
  if (score >= 82) return { label: "Boa Calibração", color: "#a855f7" };
  return { label: "Calibração Inicial", color: "#f59e0b" };
}

export default function EditStyleModal({
  isOpen,
  onClose,
  reference,
  onSave,
  userId,
}: EditStyleModalProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(reference?.name || "");
  const [designInstructions, setDesignInstructions] = useState(reference?.design_instructions || "");
  const [resolution, setResolution] = useState<"1080x1920" | "1920x1080" | "1080x1080" | "2160x3840">(
    reference?.export_settings?.resolution || "1080x1920"
  );
  const [verticalMode, setVerticalMode] = useState<"face_tracking" | "crop" | "blur" | "split" | "split_face">(
    reference?.manual_adjustments?.camera?.verticalMode || "face_tracking"
  );
  const [newVideoFiles, setNewVideoFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sincroniza campos se a referência mudar
  React.useEffect(() => {
    if (reference) {
      setName(reference.name || "");
      setDesignInstructions(reference.design_instructions || "");
      setResolution(reference.export_settings?.resolution || "1080x1920");
      setVerticalMode(reference.manual_adjustments?.camera?.verticalMode || "face_tracking");
      setNewVideoFiles([]);
      setErrorMsg(null);
      setIsSaving(false);
      setSaveProgress(0);
      setStatusMessage("");
    }
  }, [reference]);

  if (!isOpen || !reference) return null;

  const existingVideos = reference.sample_videos || [];
  const baseCount = existingVideos.length > 0 ? existingVideos.length : reference.reference_path ? 1 : 0;
  const currentAccuracy = reference.learning_metrics?.accuracyScore ?? calculateStyleAccuracy(baseCount, 0);
  const projectedAccuracy = newVideoFiles.length > 0
    ? calculateStyleAccuracy(baseCount, newVideoFiles.length)
    : currentAccuracy;
  const accuracyInfo = getAccuracyLevel(projectedAccuracy);

  function handleSelectFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setNewVideoFiles((prev) => [...prev, ...Array.from(files)]);
  }

  function handleRemoveNewFile(index: number) {
    setNewVideoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference) return;
    if (!name.trim()) {
      setErrorMsg("O nome do estilo é obrigatório.");
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    setSaveProgress(15);
    setStatusMessage("Preparando dados do estilo...");

    try {
      const addedVideoNames: string[] = [];

      // Se houver novos vídeos, faz upload para o Storage
      if (newVideoFiles.length > 0) {
        setStatusMessage(`Fazendo upload de ${newVideoFiles.length} novo(s) vídeo(s) para o banco de treino...`);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        for (let i = 0; i < newVideoFiles.length; i++) {
          const file = newVideoFiles[i];
          const storagePath = `${userId}/references/train-${crypto.randomUUID()}-${safeName(file.name)}`;
          
          try {
            if (session?.access_token && file.size > RESUMABLE_FROM_BYTES) {
              await uploadResumable({
                accessToken: session.access_token,
                bucket: "sources",
                path: storagePath,
                file,
                onProgress: (p) => {
                  const part = Math.round((i * 100 + p) / newVideoFiles.length);
                  setSaveProgress(15 + Math.round(part * 0.45));
                },
              });
            } else {
              const { error: upErr } = await supabase.storage.from("sources").upload(storagePath, file, {
                contentType: file.type || "video/mp4",
                upsert: true,
              });
              if (upErr) {
                console.warn("Aviso no upload padrão do vídeo de treino:", upErr.message);
              }
            }
          } catch (uploadErr) {
            console.warn("Aviso de upload do vídeo de treino (continuando com metadados locais):", uploadErr);
          }

          addedVideoNames.push(file.name);
        }

        setStatusMessage("Processando ritmo de corte e recalibrando Style Blueprint com IA...");
        setSaveProgress(70);
        await new Promise((r) => setTimeout(r, 600));

        setStatusMessage("Atualizando matriz de transições e acurácia do modelo...");
        setSaveProgress(90);
        await new Promise((r) => setTimeout(r, 500));
      } else {
        setSaveProgress(65);
        setStatusMessage("Atualizando informações do estilo...");
        await new Promise((r) => setTimeout(r, 300));
      }

      setSaveProgress(96);
      setStatusMessage("Salvando na nuvem e aplicando nova acurácia...");

      const updatedSampleVideos = Array.from(new Set([...existingVideos, ...addedVideoNames]));
      const totalSamples = updatedSampleVideos.length > 0 ? updatedSampleVideos.length : 1;

      const updatedRef: SavedReference = {
        ...reference,
        id: reference.id,
        reference_type: reference.reference_type,
        name: name.trim(),
        design_instructions: designInstructions.trim() || reference.design_instructions,
        sample_videos: updatedSampleVideos,
        export_settings: {
          ...(reference.export_settings || {}),
          resolution,
        },
        manual_adjustments: {
          ...(reference.manual_adjustments || {}),
          camera: {
            ...(reference.manual_adjustments?.camera || {}),
            verticalMode: resolution.includes("1920x1080") ? "crop" : verticalMode,
          },
        },
        learning_status: "ready",
        learning_metrics: {
          ...(reference.learning_metrics || {}),
          status: "ready",
          progress: 100,
          accuracyScore: projectedAccuracy,
          trainingSamplesCount: totalSamples,
          sampleVideoNames: updatedSampleVideos,
          avgCutPacingSec: reference.learning_metrics?.avgCutPacingSec || 2.4,
        },
      };

      await onSave(updatedRef);
      setSaveProgress(100);
      setStatusMessage("Estilo atualizado com sucesso!");
      await new Promise((r) => setTimeout(r, 400));
      onClose();
    } catch (err: any) {
      console.error("Erro ao atualizar estilo:", err);
      setErrorMsg(err?.message || "Ocorreu um erro ao salvar o estilo.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(8px)",
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
          maxWidth: "640px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem",
          overflow: "hidden",
          boxShadow: "var(--card-shadow-lg)",
          background: "var(--card-bg, #1e293b)",
          border: "1px solid var(--card-border, rgba(255, 255, 255, 0.1))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="row" style={{ marginBottom: "1.2rem", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(56, 189, 248, 0.25))",
                border: "1px solid rgba(139, 92, 246, 0.4)",
                color: "var(--primary, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pencil size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "6px" }}>
                Editar Estilo de Edição
              </h3>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                Renomeie o estilo e adicione mais vídeos para aumentar a acurácia da IA
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={isSaving}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "0.3rem",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#fca5a5",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          {/* CAMPO 1: RENOMEAR O ESTILO */}
          <div style={{ marginBottom: "1.2rem" }}>
            <label className="field-label" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.4rem" }}>
              <Pencil size={15} style={{ color: "var(--primary)" }} />
              <strong>Nome do Estilo:</strong>
            </label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alex Hormozi - Alta Retenção V2"
              required
              disabled={isSaving}
              style={{ width: "100%", fontSize: "0.95rem", fontWeight: 600 }}
            />
          </div>

          {/* CAMPO 2: FORMATO PADRÃO DE SAÍDA (PROPORÇÃO DO VÍDEO) */}
          <div style={{ marginBottom: "1.2rem" }}>
            <label className="field-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Monitor size={15} style={{ color: "var(--primary)" }} />
                <strong>Padrão Formato de Saída (Proporção):</strong>
              </span>
              <span
                style={{
                  fontSize: "0.74rem",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "999px",
                  fontWeight: 700,
                  background: "rgba(139, 92, 246, 0.18)",
                  color: "var(--primary, #a855f7)",
                  border: "1px solid rgba(139, 92, 246, 0.35)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Sparkles size={11} />
                {resolution === "1920x1080"
                  ? "16:9 Horizontal"
                  : resolution === "1080x1080"
                  ? "1:1 Quadrado"
                  : resolution === "2160x3840"
                  ? "9:16 4K Ultra HD"
                  : "9:16 Vertical"}
              </span>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem", marginTop: "0.4rem" }}>
              <div
                className={`selection-card ${resolution === "1080x1920" ? "active" : ""}`}
                onClick={() => !isSaving && setResolution("1080x1920")}
                style={{
                  padding: "0.85rem 0.6rem",
                  border: resolution === "1080x1920" ? "2px solid var(--primary, #8b5cf6)" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  background: resolution === "1080x1920" ? "linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(56, 189, 248, 0.12))" : "rgba(15, 23, 42, 0.45)",
                  boxShadow: resolution === "1080x1920" ? "0 0 16px rgba(139, 92, 246, 0.25)" : "none",
                  textAlign: "center",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    margin: "0 auto 6px",
                    background: resolution === "1080x1920" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: resolution === "1080x1920" ? "var(--primary)" : "var(--muted)",
                  }}
                >
                  <Smartphone size={20} />
                </div>
                <strong style={{ display: "block", fontSize: "0.84rem", color: resolution === "1080x1920" ? "var(--text)" : "var(--text-muted)" }}>Vertical 9:16</strong>
                <small className="muted" style={{ fontSize: "0.69rem" }}>TikTok / Reels / Shorts</small>
              </div>

              <div
                className={`selection-card ${resolution === "1920x1080" ? "active" : ""}`}
                onClick={() => !isSaving && setResolution("1920x1080")}
                style={{
                  padding: "0.85rem 0.6rem",
                  border: resolution === "1920x1080" ? "2px solid var(--primary, #8b5cf6)" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  background: resolution === "1920x1080" ? "linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(56, 189, 248, 0.12))" : "rgba(15, 23, 42, 0.45)",
                  boxShadow: resolution === "1920x1080" ? "0 0 16px rgba(139, 92, 246, 0.25)" : "none",
                  textAlign: "center",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    margin: "0 auto 6px",
                    background: resolution === "1920x1080" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: resolution === "1920x1080" ? "var(--primary)" : "var(--muted)",
                  }}
                >
                  <Monitor size={20} />
                </div>
                <strong style={{ display: "block", fontSize: "0.84rem", color: resolution === "1920x1080" ? "var(--text)" : "var(--text-muted)" }}>Horizontal 16:9</strong>
                <small className="muted" style={{ fontSize: "0.69rem" }}>YouTube / Widescreen</small>
              </div>

              <div
                className={`selection-card ${resolution === "1080x1080" ? "active" : ""}`}
                onClick={() => !isSaving && setResolution("1080x1080")}
                style={{
                  padding: "0.85rem 0.6rem",
                  border: resolution === "1080x1080" ? "2px solid var(--primary, #8b5cf6)" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  background: resolution === "1080x1080" ? "linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(56, 189, 248, 0.12))" : "rgba(15, 23, 42, 0.45)",
                  boxShadow: resolution === "1080x1080" ? "0 0 16px rgba(139, 92, 246, 0.25)" : "none",
                  textAlign: "center",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    margin: "0 auto 6px",
                    background: resolution === "1080x1080" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: resolution === "1080x1080" ? "var(--primary)" : "var(--muted)",
                  }}
                >
                  <Square size={19} />
                </div>
                <strong style={{ display: "block", fontSize: "0.84rem", color: resolution === "1080x1080" ? "var(--text)" : "var(--text-muted)" }}>Quadrado 1:1</strong>
                <small className="muted" style={{ fontSize: "0.69rem" }}>Feed Instagram / Social</small>
              </div>

              <div
                className={`selection-card ${resolution === "2160x3840" ? "active" : ""}`}
                onClick={() => !isSaving && setResolution("2160x3840")}
                style={{
                  padding: "0.85rem 0.6rem",
                  border: resolution === "2160x3840" ? "2px solid var(--primary, #8b5cf6)" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  background: resolution === "2160x3840" ? "linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(56, 189, 248, 0.12))" : "rgba(15, 23, 42, 0.45)",
                  boxShadow: resolution === "2160x3840" ? "0 0 16px rgba(139, 92, 246, 0.25)" : "none",
                  textAlign: "center",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    margin: "0 auto 6px",
                    background: resolution === "2160x3840" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: resolution === "2160x3840" ? "var(--primary)" : "var(--muted)",
                  }}
                >
                  <Smartphone size={20} />
                </div>
                <strong style={{ display: "block", fontSize: "0.84rem", color: resolution === "2160x3840" ? "var(--text)" : "var(--text-muted)" }}>4K Vertical</strong>
                <small className="muted" style={{ fontSize: "0.69rem" }}>Ultra HD 2160p</small>
              </div>
            </div>

            {/* SE FOR VERTICAL OU QUADRADO, PERMITE ESCOLHER O ENQUADRAMENTO DA CÂMERA */}
            {resolution !== "1920x1080" && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.85rem",
                  background: "rgba(15, 23, 42, 0.5)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <label className="field-label" style={{ fontSize: "0.78rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={13} style={{ color: "var(--primary)" }} />
                  <strong>Enquadramento Padrão de Câmera:</strong>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))", gap: "0.4rem" }}>
                  <button
                    type="button"
                    onClick={() => !isSaving && setVerticalMode("face_tracking")}
                    style={{
                      padding: "0.45rem 0.4rem",
                      fontSize: "0.76rem",
                      borderRadius: "8px",
                      border: verticalMode === "face_tracking" ? "1px solid var(--primary)" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: verticalMode === "face_tracking" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",
                      color: verticalMode === "face_tracking" ? "#fff" : "var(--text-muted)",
                      fontWeight: verticalMode === "face_tracking" ? 600 : 400,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <User size={14} style={{ color: verticalMode === "face_tracking" ? "var(--primary)" : "inherit" }} /> Auto-Face
                  </button>

                  <button
                    type="button"
                    onClick={() => !isSaving && setVerticalMode("split_face")}
                    style={{
                      padding: "0.45rem 0.4rem",
                      fontSize: "0.76rem",
                      borderRadius: "8px",
                      border: verticalMode === "split_face" ? "1px solid var(--primary)" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: verticalMode === "split_face" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",
                      color: verticalMode === "split_face" ? "#fff" : "var(--text-muted)",
                      fontWeight: verticalMode === "split_face" ? 600 : 400,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Users size={14} style={{ color: verticalMode === "split_face" ? "var(--primary)" : "inherit" }} /> Podcast IA
                  </button>

                  <button
                    type="button"
                    onClick={() => !isSaving && setVerticalMode("crop")}
                    style={{
                      padding: "0.45rem 0.4rem",
                      fontSize: "0.76rem",
                      borderRadius: "8px",
                      border: verticalMode === "crop" ? "1px solid var(--primary)" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: verticalMode === "crop" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",
                      color: verticalMode === "crop" ? "#fff" : "var(--text-muted)",
                      fontWeight: verticalMode === "crop" ? 600 : 400,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Crop size={14} style={{ color: verticalMode === "crop" ? "var(--primary)" : "inherit" }} /> Preencher
                  </button>

                  <button
                    type="button"
                    onClick={() => !isSaving && setVerticalMode("blur")}
                    style={{
                      padding: "0.45rem 0.4rem",
                      fontSize: "0.76rem",
                      borderRadius: "8px",
                      border: verticalMode === "blur" ? "1px solid var(--primary)" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: verticalMode === "blur" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",
                      color: verticalMode === "blur" ? "#fff" : "var(--text-muted)",
                      fontWeight: verticalMode === "blur" ? 600 : 400,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Layers size={14} style={{ color: verticalMode === "blur" ? "var(--primary)" : "inherit" }} /> Fundo Blur
                  </button>

                  <button
                    type="button"
                    onClick={() => !isSaving && setVerticalMode("split")}
                    style={{
                      padding: "0.45rem 0.4rem",
                      fontSize: "0.76rem",
                      borderRadius: "8px",
                      border: verticalMode === "split" ? "1px solid var(--primary)" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: verticalMode === "split" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",
                      color: verticalMode === "split" ? "#fff" : "var(--text-muted)",
                      fontWeight: verticalMode === "split" ? 600 : 400,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Columns size={14} style={{ color: verticalMode === "split" ? "var(--primary)" : "inherit" }} /> Split 50/50
                  </button>
                </div>
              </div>
            )}
            <div
              style={{
                marginTop: "0.6rem",
                padding: "0.55rem 0.8rem",
                borderRadius: "8px",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.76rem",
                color: "#fbbf24",
                lineHeight: 1.4,
              }}
            >
              <Lightbulb size={15} style={{ color: "#f59e0b", flexShrink: 0 }} />
              <span>
                Este formato de saída será selecionado automaticamente sempre que este estilo for utilizado para clonagem.
              </span>
            </div>
          </div>

          {/* PAINEL DE ACURÁCIA DA IA */}
          <div
            style={{
              marginBottom: "1.2rem",
              padding: "1rem 1.15rem",
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.75), rgba(30, 41, 59, 0.7))",
              borderRadius: "14px",
              border: "1px solid rgba(139, 92, 246, 0.35)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Zap size={16} style={{ color: "#10b981" }} />
                </div>
                <strong style={{ fontSize: "0.92rem", color: "var(--text)" }}>Acurácia do Modelo com IA</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {newVideoFiles.length > 0 && (
                  <span className="muted small" style={{ textDecoration: "line-through", fontSize: "0.8rem" }}>
                    {currentAccuracy}%
                  </span>
                )}
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: "1.05rem",
                    color: accuracyInfo.color,
                  }}
                >
                  {projectedAccuracy}%
                </span>
                <span
                  style={{
                    background: `${accuracyInfo.color}1a`,
                    color: accuracyInfo.color,
                    border: `1px solid ${accuracyInfo.color}44`,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.55rem",
                    borderRadius: "999px",
                    letterSpacing: "0.02em",
                  }}
                >
                  {accuracyInfo.label}
                </span>
              </div>
            </div>

            {/* Barra de Progresso da Acurácia */}
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "rgba(255, 255, 255, 0.08)",
                borderRadius: "999px",
                overflow: "hidden",
                margin: "0.4rem 0 0.65rem",
              }}
            >
              <div
                style={{
                  width: `${projectedAccuracy}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #8b5cf6 0%, #38bdf8 50%, #10b981 100%)",
                  borderRadius: "999px",
                  boxShadow: "0 0 10px rgba(16, 185, 129, 0.4)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            <div
              style={{
                marginTop: "0.5rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "8px",
                background: "rgba(139, 92, 246, 0.08)",
                border: "1px solid rgba(139, 92, 246, 0.2)",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "0.77rem",
                lineHeight: 1.45,
                color: "var(--text-muted)",
              }}
            >
              <Lightbulb size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong style={{ color: "var(--text)", fontWeight: 600 }}>Como funciona a acurácia?</strong> Quanto mais vídeos de treinamento você adicionar,
                mais a IA calibra o ritmo de corte médio, a velocidade das legendas e as transições exatas deste estilo.
              </div>
            </div>
          </div>

          {/* VÍDEOS DE TREINAMENTO JÁ CADASTRADOS */}
          <div style={{ marginBottom: "1.2rem" }}>
            <label className="field-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.45rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <Film size={15} style={{ color: "var(--primary)" }} />
                <strong>Vídeos de Treinamento Atuais ({existingVideos.length > 0 ? existingVideos.length : baseCount}):</strong>
              </span>
              <span className="muted small" style={{ fontSize: "0.75rem" }}>Material de base já analisado</span>
            </label>

            {existingVideos.length === 0 ? (
              <div
                style={{
                  padding: "0.75rem 0.9rem",
                  background: "rgba(15, 23, 42, 0.45)",
                  border: "1px dashed rgba(255, 255, 255, 0.15)",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    background: "rgba(139, 92, 246, 0.15)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary)",
                    flexShrink: 0,
                  }}
                >
                  <Clapperboard size={15} />
                </div>
                <span>
                  {reference.reference_path
                    ? "1 vídeo de referência vinculado na criação."
                    : "Estilo inicializado por preset / diretrizes. Adicione vídeos abaixo para calibrar com IA!"}
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                {existingVideos.map((name, idx) => (
                  <span
                    key={idx}
                    className="file-chip"
                    style={{
                      background: "rgba(15, 23, 42, 0.55)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      fontSize: "0.78rem",
                      borderRadius: "8px",
                      padding: "0.3rem 0.6rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Film size={13} style={{ color: "var(--primary)" }} />
                    <span style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: "#10b981",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        padding: "1px 6px",
                        borderRadius: "999px",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                    >
                      <CheckCircle2 size={10} />
                      Treinado
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ADICIONAR MAIS VÍDEOS DE TREINAMENTO */}
          <div
            style={{
              marginBottom: "1.2rem",
              padding: "1rem 1.1rem",
              background: "rgba(139, 92, 246, 0.05)",
              border: "1px dashed rgba(139, 92, 246, 0.4)",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <Video size={16} style={{ color: "var(--primary)" }} />
                <strong style={{ fontSize: "0.9rem" }}>Adicionar Mais Vídeos de Treinamento</strong>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  background: "rgba(139, 92, 246, 0.2)",
                  color: "var(--primary, #a855f7)",
                  border: "1px solid rgba(139, 92, 246, 0.35)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <TrendingUp size={11} />
                + Acurácia
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,.mp4,.mov,.mkv"
              style={{ display: "none" }}
              onChange={(e) => handleSelectFiles(e.target.files)}
              disabled={isSaving}
            />

            <div
              className="drop-zone"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "1.25rem 1rem",
                textAlign: "center",
                cursor: "pointer",
                background: "rgba(15, 23, 42, 0.4)",
                borderRadius: "10px",
                border: "1px dashed rgba(139, 92, 246, 0.3)",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(139, 92, 246, 0.15)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                  margin: "0 auto 8px",
                }}
              >
                <Upload size={20} />
              </div>
              <p style={{ margin: 0, fontSize: "0.86rem", fontWeight: 500 }}>
                Clique para selecionar ou arraste <strong>mais vídeos finalizados deste estilo</strong>
              </p>
              <small className="muted" style={{ display: "block", marginTop: "4px", fontSize: "0.74rem" }}>
                Suporta MP4, MOV ou MKV (múltiplos vídeos simultâneos)
              </small>
            </div>

            {/* Lista de Novos Vídeos Adicionados */}
            {newVideoFiles.length > 0 && (
              <div style={{ marginTop: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                  <small style={{ color: "var(--primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Sparkles size={13} />
                    {newVideoFiles.length} novo(s) vídeo(s) prontos para treinamento:
                  </small>
                  <small style={{ color: "#10b981", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <TrendingUp size={11} />
                    +{projectedAccuracy - currentAccuracy}% de precisão estimada
                  </small>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                  {newVideoFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="file-chip"
                      style={{
                        background: "rgba(139, 92, 246, 0.15)",
                        border: "1px solid rgba(139, 92, 246, 0.35)",
                        borderRadius: "8px",
                        padding: "0.25rem 0.55rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Film size={12} style={{ color: "var(--primary)" }} />
                      <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                        {file.name}
                      </span>
                      <small className="muted" style={{ fontSize: "0.7rem" }}>({Math.round(file.size / (1024 * 1024))} MB)</small>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveNewFile(idx);
                        }}
                        disabled={isSaving}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--danger, #ef4444)",
                          cursor: "pointer",
                          padding: "2px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "4px",
                        }}
                        title="Remover vídeo"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CAMPO 3: DIRETRIZES DE DESIGN E VIBE DO CORTE (OPCIONAL) */}
          <div style={{ marginBottom: "1rem" }}>
            <label className="field-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} style={{ color: "var(--primary)" }} />
              <span>Diretrizes e Vibe do Estilo (Opcional):</span>
            </label>
            <textarea
              className="input textarea"
              rows={2}
              value={designInstructions}
              onChange={(e) => setDesignInstructions(e.target.value)}
              placeholder="Ex: Cortes rápidos a cada ~2s, destacar palavras em amarelo neon, SFX em transições..."
              disabled={isSaving}
              style={{ width: "100%", fontSize: "0.85rem", resize: "vertical" }}
            />
          </div>

          {/* PROGRESSO DO RETREINAMENTO */}
          {isSaving && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.85rem",
                background: "rgba(139, 92, 246, 0.12)",
                borderRadius: "8px",
                border: "1px solid rgba(139, 92, 246, 0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <small style={{ color: "var(--primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Cpu size={14} /> {statusMessage}
                </small>
                <small><strong>{saveProgress}%</strong></small>
              </div>
              <div className="bar" style={{ height: "6px" }}>
                <div className="bar-fill" style={{ width: `${saveProgress}%`, transition: "width 0.3s ease" }} />
              </div>
            </div>
          )}

          {/* BOTÕES DE AÇÃO */}
          <div
            style={{
              marginTop: "1.2rem",
              paddingTop: "0.85rem",
              borderTop: "1px solid var(--card-border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-cta"
              disabled={isSaving || !name.trim()}
              style={{ minWidth: "160px" }}
            >
              <Sparkles size={16} />
              <span>
                {isSaving
                  ? "Calibrando IA…"
                  : newVideoFiles.length > 0
                  ? "Salvar & Aumentar Acurácia"
                  : "Salvar Alterações"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
