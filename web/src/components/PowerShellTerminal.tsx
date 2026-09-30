"use client";

import { useEffect, useRef, useState } from "react";
import type { JobStatus } from "@/lib/types";

interface PowerShellTerminalProps {
  logs: string[];
  status: JobStatus;
  jobId: string;
}

export default function PowerShellTerminal({ logs = [], status, jobId }: PowerShellTerminalProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const isRunning = !["done", "failed", "canceled"].includes(status);

  // Auto-scroll para o final quando novos logs chegam
  useEffect(() => {
    if (terminalBodyRef.current && isExpanded) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const copyLogs = async () => {
    try {
      const fullText = [
        "Windows PowerShell",
        "Copyright (C) Microsoft Corporation. Todos os direitos reservados.",
        "",
        `PS C:\\cortes-virais> .\\processar.ps1 -JobId "${jobId}"`,
        ...logs,
      ].join("\n");
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Falha ao copiar logs:", err);
    }
  };

  const formatLogLine = (line: string, index: number) => {
    // Procura por timestamps [HH:MM:SS]
    const timeMatch = line.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*(.*)$/);
    const timestamp = timeMatch ? timeMatch[1] : null;
    const content = timeMatch ? timeMatch[2] : line;

    // Detecta tipo de mensagem para coloração
    let contentColor = "#eeedf0";
    if (/\[?ERRO\]?/i.test(content) || /falh(a|ou)/i.test(content) || /error/i.test(content)) {
      contentColor = "#ff6b6b";
    } else if (/\[?CANCELADO\]?/i.test(content) || /cancel/i.test(content)) {
      contentColor = "#ffd13b";
    } else if (/\[?SUCESSO\]?|\[?CONCLU[IÍ]DO\]?|pronto/i.test(content)) {
      contentColor = "#4ade80";
    } else if (/\[?CONFIG\]?|\[?INFO\]?/i.test(content)) {
      contentColor = "#38bdf8";
    } else if (/\[Render|\bCortando\b/i.test(content)) {
      contentColor = "#c084fc";
    }

    return (
      <div key={index} className="ps-log-line">
        {timestamp && <span className="ps-time">{timestamp} </span>}
        <span style={{ color: contentColor }}>{content}</span>
      </div>
    );
  };

  return (
    <div className={`ps-window ${isMaximized ? "ps-maximized" : ""}`}>
      {/* Barra de Título do PowerShell */}
      <div className="ps-header">
        <div className="ps-title">
          <svg className="ps-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/>
            <path d="M4.5 4a.5.5 0 0 0-.354.854L6.293 7 4.146 9.146a.5.5 0 1 0 .708.708l2.5-2.5a.5.5 0 0 0 0-.708l-2.5-2.5A.5.5 0 0 0 4.5 4zm4 6a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4z"/>
          </svg>
          <span>Windows PowerShell &mdash; [Backend do Processo]</span>
          {isRunning && <span className="ps-live-badge">● AO VIVO</span>}
        </div>
        <div className="ps-controls">
          <button
            type="button"
            className="ps-btn-action"
            onClick={copyLogs}
            title="Copiar saída do terminal"
          >
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            className="ps-ctrl-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimizar" : "Restaurar"}
          >
            &minus;
          </button>
          <button
            type="button"
            className="ps-ctrl-btn"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restaurar tamanho" : "Maximizar"}
          >
            &#9633;
          </button>
        </div>
      </div>

      {/* Corpo do Terminal */}
      {isExpanded && (
        <div className="ps-body" ref={terminalBodyRef}>
          <div className="ps-banner">
            <div>Windows PowerShell</div>
            <div>Copyright (C) Microsoft Corporation. Todos os direitos reservados.</div>
            <div className="ps-banner-sub">
              Ambiente de Execução do Pipeline de Vídeo &bull; Node.js Worker &bull; Deepgram &bull; Claude &bull; FFmpeg
            </div>
          </div>

          <div className="ps-prompt">
            <span className="ps-prompt-path">PS C:\cortes-virais&gt;</span>{" "}
            <span className="ps-prompt-cmd">.\processar-video.ps1 -JobId &quot;{jobId}&quot;</span>
          </div>

          <div className="ps-logs">
            {logs.length === 0 ? (
              <div className="ps-muted-line">Aguardando o worker iniciar as etapas...</div>
            ) : (
              logs.map((log, i) => formatLogLine(log, i))
            )}

            {/* Linha final com status e cursor */}
            {isRunning && (
              <div className="ps-running-indicator">
                <span className="ps-prompt-path">PS C:\cortes-virais&gt;</span>{" "}
                <span className="ps-active-stage">
                  [Etapa atual: {status}]
                </span>
                <span className="ps-cursor">_</span>
              </div>
            )}

            {!isRunning && status === "done" && (
              <div className="ps-finished-success">
                <span className="ps-prompt-path">PS C:\cortes-virais&gt;</span>{" "}
                <span style={{ color: "#4ade80" }}>[Processo finalizado com sucesso!]</span>
              </div>
            )}

            {!isRunning && status === "canceled" && (
              <div className="ps-finished-canceled">
                <span className="ps-prompt-path">PS C:\cortes-virais&gt;</span>{" "}
                <span style={{ color: "#ffd13b" }}>[Processo cancelado pelo usuário]</span>
              </div>
            )}

            {!isRunning && status === "failed" && (
              <div className="ps-finished-failed">
                <span className="ps-prompt-path">PS C:\cortes-virais&gt;</span>{" "}
                <span style={{ color: "#ff6b6b" }}>[Processo encerrado com erro]</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estilos encapsulados para o visual idêntico ao PowerShell */}
      <style jsx>{`
        .ps-window {
          background-color: #012456;
          color: #eeedf0;
          font-family: Consolas, "Cascadia Code", "Courier New", monospace;
          font-size: 0.86rem;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
          border: 1px solid #1a3f7a;
          margin: 0.75rem 0;
          transition: all 0.2s ease-in-out;
        }

        .ps-maximized {
          position: fixed;
          top: 1rem;
          left: 1rem;
          right: 1rem;
          bottom: 1rem;
          z-index: 100;
          margin: 0;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
        }

        .ps-maximized .ps-body {
          flex: 1;
          max-height: calc(100vh - 5rem);
        }

        .ps-header {
          background-color: #011c43;
          border-bottom: 1px solid #001430;
          padding: 0.45rem 0.85rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          user-select: none;
        }

        .ps-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: #cbd5e1;
          letter-spacing: 0.02em;
        }

        .ps-icon {
          color: #38bdf8;
        }

        .ps-live-badge {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
          font-size: 0.68rem;
          font-weight: bold;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          animation: pulse 1.8s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .ps-controls {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .ps-btn-action {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
          padding: 0.2rem 0.55rem;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }

        .ps-btn-action:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .ps-ctrl-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          width: 24px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 0.9rem;
          border-radius: 3px;
        }

        .ps-ctrl-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .ps-body {
          background-color: #012456;
          padding: 0.85rem 1rem 1.1rem;
          max-height: 320px;
          overflow-y: auto;
          line-height: 1.45;
          scrollbar-width: thin;
          scrollbar-color: #1a4c8c #012456;
        }

        .ps-body::-webkit-scrollbar {
          width: 8px;
        }

        .ps-body::-webkit-scrollbar-track {
          background: #012456;
        }

        .ps-body::-webkit-scrollbar-thumb {
          background: #1a4c8c;
          border-radius: 4px;
        }

        .ps-banner {
          color: #cbd5e1;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.15);
        }

        .ps-banner-sub {
          color: #7dd3fc;
          font-size: 0.78rem;
          margin-top: 0.25rem;
        }

        .ps-prompt {
          margin-bottom: 0.5rem;
        }

        .ps-prompt-path {
          color: #facc15;
          font-weight: 600;
        }

        .ps-prompt-cmd {
          color: #ffffff;
        }

        .ps-logs {
          display: flex;
          flex-direction: column;
          gap: 0.22rem;
        }

        .ps-log-line {
          white-space: pre-wrap;
          word-break: break-word;
        }

        .ps-time {
          color: #38bdf8;
          opacity: 0.9;
        }

        .ps-muted-line {
          color: #93c5fd;
          font-style: italic;
          opacity: 0.75;
        }

        .ps-running-indicator {
          margin-top: 0.4rem;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .ps-active-stage {
          color: #ffd13b;
        }

        .ps-cursor {
          display: inline-block;
          font-weight: bold;
          color: #ffffff;
          animation: blink 1s step-start infinite;
        }

        @keyframes blink {
          50% { opacity: 0; }
        }

        .ps-finished-success,
        .ps-finished-canceled,
        .ps-finished-failed {
          margin-top: 0.4rem;
        }
      `}</style>
    </div>
  );
}
