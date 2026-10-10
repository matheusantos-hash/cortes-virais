"use client";

import React, { useState } from "react";
import type { Job, JobStatus } from "@/lib/types";
import { jobTitle } from "@/lib/format";
import PowerShellTerminal from "./PowerShellTerminal";
import StatusBadge from "./StatusBadge";
import {
  ActivityIcon,
  ChevronUp,
  ChevronDown,
  X,
  Scissors,
  Copy,
  FolderKanban,
} from "./Icons";

export function isCloneJob(job: Job): boolean {
  return Boolean(
    job.reference_type ||
    job.reference_style ||
    job.reference_path ||
    job.reference_url ||
    job.design_instructions?.toLowerCase().includes("clonag")
  );
}

export function getStageDescription(status: JobStatus, isClone: boolean = false): string {
  switch (status) {
    case "queued":
      return isClone
        ? "Aguardando na fila para clonagem de estilo e edição…"
        : "Aguardando na fila de processamento do servidor…";
    case "downloading":
      return "Baixando vídeo fonte em alta qualidade com yt-dlp…";
    case "transcribing":
      return "Transcrevendo áudio e sincronizando falas com Deepgram AI…";
    case "analyzing":
      return isClone
        ? "Claude Sonnet analisando DNA de estilo, ritmo e referências visuais…"
        : "Claude Sonnet analisando ganchos virais e roteiro…";
    case "cutting":
      return isClone
        ? "Renderizando clonagem com ritmo, legendas e cortes via FFmpeg…"
        : "Renderizando cortes e sobrepondo B-rolls com FFmpeg…";
    case "done":
      return "Processamento concluído com sucesso!";
    case "failed":
      return "Falha durante o processamento.";
    case "canceled":
      return "Processamento cancelado pelo usuário.";
    default:
      return "Processando…";
  }
}

interface JobProgressCardProps {
  job: Job;
  onCancel: (jobId: string) => Promise<void> | void;
  canceling?: boolean;
  projectName?: string;
}

export default function JobProgressCard({
  job,
  onCancel,
  canceling = false,
  projectName,
}: JobProgressCardProps) {
  const [showTerminal, setShowTerminal] = useState(true);
  const isClone = isCloneJob(job);

  return (
    <div
      id="card-monitor-ativo"
      className="card progress-card-active stack"
      style={{
        border: isClone ? "1px solid rgba(139, 92, 246, 0.45)" : "1px solid rgba(79, 70, 229, 0.45)",
        background: isClone
          ? "linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, var(--card-bg) 100%)"
          : "linear-gradient(180deg, rgba(79, 70, 229, 0.08) 0%, var(--card-bg) 100%)",
        boxShadow: isClone
          ? "0 4px 20px rgba(139, 92, 246, 0.15)"
          : "0 4px 20px rgba(79, 70, 229, 0.15)",
      }}
    >
      <div className="progress-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ justifyContent: "flex-start", gap: "0.5rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
            <span className="badge badge-queued" style={{ animation: "pulse-dot 2s infinite" }}>
              ● EM ANDAMENTO
            </span>
            <StatusBadge status={job.status} />

            {/* Badge distintivo de Corte ou Clonagem */}
            {isClone ? (
              <span
                className="badge"
                style={{
                  background: "rgba(139, 92, 246, 0.2)",
                  color: "#c084fc",
                  border: "1px solid rgba(139, 92, 246, 0.4)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                <Copy size={12} />
                Clonagem de Estilo
              </span>
            ) : (
              <span
                className="badge"
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                <Scissors size={12} />
                Corte AI
              </span>
            )}

            {projectName && (
              <span
                className="badge"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--card-border)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.72rem",
                }}
              >
                <FolderKanban size={11} />
                {projectName}
              </span>
            )}
          </div>

          <h3 className="ellipsis" style={{ fontSize: "1.2rem", margin: 0, fontWeight: 700 }}>
            {jobTitle(job)}
          </h3>
        </div>

        <div className="progress-pct-huge">
          {job.progress}%
        </div>
      </div>

      {/* Barra de Progresso Animada Neon */}
      <div className="bar" style={{ height: "11px" }}>
        <div
          className="bar-fill"
          style={{
            width: `${Math.max(job.progress, 5)}%`,
            background: isClone
              ? "linear-gradient(90deg, #8B5CF6, #EC4899)"
              : "linear-gradient(90deg, var(--primary), var(--accent))",
          }}
        />
      </div>

      {/* Mensagem da Etapa Atual e Botões */}
      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem", justifyContent: "space-between" }}>
        <span className="stage-pill" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <ActivityIcon size={14} style={{ color: isClone ? "#c084fc" : "var(--primary)" }} />
          {getStageDescription(job.status, isClone)}
        </span>

        <div className="row" style={{ gap: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={() => setShowTerminal(!showTerminal)}
            title="Exibir ou recolher saída do terminal PowerShell"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            {showTerminal ? (
              <>
                <ChevronUp size={14} /> Recolher Terminal
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Mostrar Terminal
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-small btn-danger-outline"
            onClick={() => onCancel(job.id)}
            disabled={canceling}
            title="Interromper processamento"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <X size={14} />
            <span>{canceling ? "Cancelando…" : "Cancelar Processo"}</span>
          </button>
        </div>
      </div>

      {/* Console de Logs Estilo Terminal */}
      {showTerminal && (
        <div style={{ marginTop: "0.4rem" }}>
          <PowerShellTerminal
            logs={job.logs ?? []}
            status={job.status}
            jobId={job.id}
          />
        </div>
      )}
    </div>
  );
}
