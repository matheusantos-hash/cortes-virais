"use client";

import React, { useState } from "react";
import type { Clip, Job } from "@/lib/types";
import { generateCapCutDraft } from "@/lib/export/capcut";
import { generateClipSrt } from "@/lib/export/srt";
import {
  DownloadIcon,
  XIcon,
  Film,
  FileCode,
  Check,
  FolderKanban,
  Clock,
  Subtitles,
  Smartphone,
} from "./Icons";

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  selectedClips: Clip[];
  signedUrls: Record<string, string>;
}

type ExportMode = "mp4_finished" | "capcut_draft" | "nle_bundle";

export default function BatchExportModal({
  isOpen,
  onClose,
  job,
  selectedClips,
  signedUrls,
}: BatchExportModalProps) {
  const [selectedMode, setSelectedMode] = useState<ExportMode>("capcut_draft");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownloadSingleCapCutDraft = (clip: Clip) => {
    const draft = generateCapCutDraft(clip);
    // Cria download de draft_content.json
    const blob = new Blob([draft.draftContentJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `draft_content_${clip.position || 1}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportBatch = async () => {
    setIsProcessing(true);
    setDownloadSuccess(false);

    try {
      if (selectedMode === "mp4_finished") {
        setProgressMsg(`Iniciando download de ${selectedClips.length} vídeos finalizados...`);
        // Dispara download dos vídeos individualmente para evitar bloqueio e consumo excessivo de memória
        for (let i = 0; i < selectedClips.length; i++) {
          const c = selectedClips[i];
          const url = c.file_path ? signedUrls[c.file_path] : null;
          if (url) {
            setProgressMsg(`Baixando corte ${i + 1} de ${selectedClips.length}...`);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${c.title || `corte_${c.position}`}.mp4`;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            await new Promise((r) => setTimeout(r, 600)); // Pequena pausa para o navegador aceitar downloads múltiplos
          }
        }
      } else if (selectedMode === "capcut_draft") {
        setProgressMsg(`Gerando projetos editáveis do CapCut para ${selectedClips.length} cortes...`);
        // Para cada clipe selecionado, gera e baixa seu draft_content.json e SRT sincronizado
        for (let i = 0; i < selectedClips.length; i++) {
          const c = selectedClips[i];
          setProgressMsg(`Exportando rascunho CapCut do corte ${c.position} (${i + 1}/${selectedClips.length})...`);
          handleDownloadSingleCapCutDraft(c);
          await new Promise((r) => setTimeout(r, 350));
        }
      } else if (selectedMode === "nle_bundle") {
        setProgressMsg("Gerando pacote XML / EDL / SRT para Premiere e DaVinci...");
        // Redireciona para o endpoint oficial de exportação
        window.open(`/api/jobs/${job.id}/export?format=xml`, "_blank");
        await new Promise((r) => setTimeout(r, 300));
        window.open(`/api/jobs/${job.id}/export?format=srt`, "_blank");
      }

      setDownloadSuccess(true);
      setProgressMsg("Exportação concluída com sucesso!");
    } catch (err: any) {
      console.error("Erro na exportação em lote:", err);
      setProgressMsg("Erro ao processar a exportação. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card stack"
        style={{
          maxWidth: "600px",
          width: "100%",
          background: "var(--card-bg, #111827)",
          border: "1px solid var(--card-border, rgba(255, 255, 255, 0.12))",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(139, 92, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary, #8b5cf6)",
              }}
            >
              <DownloadIcon size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                Exportação em Lote
              </h3>
              <p className="muted small" style={{ margin: 0 }}>
                {selectedClips.length} {selectedClips.length === 1 ? "corte selecionado" : "cortes selecionados"} para download
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={onClose}
            style={{ borderRadius: "50%", width: "32px", height: "32px", padding: 0 }}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Seleção de Formato */}
        <div className="stack" style={{ gap: "0.85rem", marginTop: "1rem" }}>
          <label className="field-label" style={{ fontWeight: 600 }}>
            Escolha o formato de entrega:
          </label>

          {/* Opção 1: CapCut Draft */}
          <div
            onClick={() => setSelectedMode("capcut_draft")}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              cursor: "pointer",
              border: selectedMode === "capcut_draft" ? "2px solid var(--primary, #8b5cf6)" : "1px solid var(--card-border, rgba(255, 255, 255, 0.1))",
              background: selectedMode === "capcut_draft" ? "rgba(139, 92, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              transition: "all 0.15s ease",
            }}
          >
            <input
              type="radio"
              name="exportMode"
              checked={selectedMode === "capcut_draft"}
              onChange={() => setSelectedMode("capcut_draft")}
              style={{ marginTop: "3px", accentColor: "var(--primary, #8b5cf6)" }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "0.95rem" }}>Projeto Editável CapCut Desktop</strong>
                <span className="badge" style={{ fontSize: "0.68rem", background: "rgba(16, 185, 129, 0.2)", color: "#10b981" }}>
                  Recomendado
                </span>
              </div>
              <p className="muted small" style={{ margin: "4px 0 0" }}>
                Gera os rascunhos nativos do CapCut (<code>draft_content.json</code>). As legendas entram como blocos de texto 100% editáveis no CapCut, permitindo trocar animações, cores e fontes livremente.
              </p>
            </div>
          </div>

          {/* Opção 2: MP4 Finalizado */}
          <div
            onClick={() => setSelectedMode("mp4_finished")}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              cursor: "pointer",
              border: selectedMode === "mp4_finished" ? "2px solid var(--primary, #8b5cf6)" : "1px solid var(--card-border, rgba(255, 255, 255, 0.1))",
              background: selectedMode === "mp4_finished" ? "rgba(139, 92, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              transition: "all 0.15s ease",
            }}
          >
            <input
              type="radio"
              name="exportMode"
              checked={selectedMode === "mp4_finished"}
              onChange={() => setSelectedMode("mp4_finished")}
              style={{ marginTop: "3px", accentColor: "var(--primary, #8b5cf6)" }}
            />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: "0.95rem" }}>Vídeos Finalizados (MP4 Prontos para Postar)</strong>
              <p className="muted small" style={{ margin: "4px 0 0" }}>
                Baixa os vídeos já renderizados com legendas e efeitos cravados diretamente no vídeo. Ideal para postar sem precisar editar nada no computador.
              </p>
            </div>
          </div>

          {/* Opção 3: NLE Bundle */}
          <div
            onClick={() => setSelectedMode("nle_bundle")}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              cursor: "pointer",
              border: selectedMode === "nle_bundle" ? "2px solid var(--primary, #8b5cf6)" : "1px solid var(--card-border, rgba(255, 255, 255, 0.1))",
              background: selectedMode === "nle_bundle" ? "rgba(139, 92, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              transition: "all 0.15s ease",
            }}
          >
            <input
              type="radio"
              name="exportMode"
              checked={selectedMode === "nle_bundle"}
              onChange={() => setSelectedMode("nle_bundle")}
              style={{ marginTop: "3px", accentColor: "var(--primary, #8b5cf6)" }}
            />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: "0.95rem" }}>Pacote NLE Pro (Premiere Pro &amp; DaVinci Resolve)</strong>
              <p className="muted small" style={{ margin: "4px 0 0" }}>
                Gera arquivos XML FCP7, EDL CMX3600 e legendas SRT sincronizadas com timecode para edição em suites profissionais.
              </p>
            </div>
          </div>
        </div>

        {/* Status / Progresso */}
        {progressMsg && (
          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem",
              borderRadius: "8px",
              background: downloadSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(139, 92, 246, 0.15)",
              color: downloadSuccess ? "#10b981" : "var(--primary, #a78bfa)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {downloadSuccess ? <Check size={16} /> : <Clock size={16} />}
            <span>{progressMsg}</span>
          </div>
        )}

        {/* Footer / Ações */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "1rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn btn-cta"
            onClick={handleExportBatch}
            disabled={isProcessing || selectedClips.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <DownloadIcon size={16} />
            <span>{isProcessing ? "Processando..." : `Exportar ${selectedClips.length} Cortes`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
