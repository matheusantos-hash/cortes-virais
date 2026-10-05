"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip } from "@/lib/types";
import { fmtClock } from "@/lib/format";
import { DownloadIcon, SparklesIcon, XIcon, FlameIcon } from "./Icons";

interface ClipEditorModalProps {
  clip: Clip;
  videoSrc?: string;
  onClose: () => void;
  onUpdateClipTime?: (clipId: string, trimStart: number, trimEnd: number) => Promise<void> | void;
}

export default function ClipEditorModal({
  clip,
  videoSrc,
  onClose,
  onUpdateClipTime,
}: ClipEditorModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const duration = Math.max(1, Number(clip.end_seconds) - Number(clip.start_seconds));
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(duration);
  const [activeTab, setActiveTab] = useState<"trim" | "thumbnail" | "formats">("trim");
  const [isSavingTrim, setIsSavingTrim] = useState(false);

  // Estados da Capa / Thumbnail
  const [thumbTitle, setThumbTitle] = useState(clip.title);
  const [titleColor, setTitleColor] = useState<"yellow" | "white" | "cyan">("yellow");
  const [capturedThumbUrl, setCapturedThumbUrl] = useState<string | null>(null);

  // Sincroniza tempo atual do player
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const setStartToCurrent = () => {
    if (!videoRef.current) return;
    const t = Math.min(videoRef.current.currentTime, trimEnd - 1);
    setTrimStart(Number(t.toFixed(1)));
  };

  const setEndToCurrent = () => {
    if (!videoRef.current) return;
    const t = Math.max(videoRef.current.currentTime, trimStart + 1);
    setTrimEnd(Number(t.toFixed(1)));
  };

  const playSelectedRange = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = trimStart;
    videoRef.current.play();
  };

  // Captura um frame do vídeo para criar a thumbnail estilizada
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resolução Full HD Vertical (1080 x 1920)
    canvas.width = 1080;
    canvas.height = 1920;

    // 1. Desenha o frame do vídeo
    ctx.drawImage(video, 0, 0, 1080, 1920);

    // 2. Adiciona vinheta escura suave na base e no topo para legibilidade
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
    grad.addColorStop(0.25, "rgba(0, 0, 0, 0)");
    grad.addColorStop(0.65, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // 3. Renderiza o Título Viral estilizado na parte central superior
    const text = thumbTitle.toUpperCase();
    ctx.font = "900 68px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let fillHex = "#FFE600"; // Amarelo vibrante
    if (titleColor === "white") fillHex = "#FFFFFF";
    if (titleColor === "cyan") fillHex = "#00F0FF";

    // Contorno preto pesado
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 14;
    ctx.lineJoin = "round";

    // Quebra de texto simples em até 3 linhas
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const w of words) {
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      if (testLine.length > 22) {
        lines.push(currentLine);
        currentLine = w;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const startY = 320;
    lines.forEach((line, idx) => {
      const y = startY + idx * 82;
      ctx.strokeText(line, 540, y);
      ctx.fillStyle = fillHex;
      ctx.fillText(line, 540, y);
    });

    // 4. Badge viral no topo
    ctx.fillStyle = "#EF4444";
    ctx.beginPath();
    ctx.roundRect(420, 170, 240, 56, 28);
    ctx.fill();

    ctx.font = "800 28px Arial, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("🔥 VIRAL", 540, 198);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setCapturedThumbUrl(dataUrl);
  };

  const downloadThumbnail = () => {
    if (!capturedThumbUrl) return;
    const a = document.createElement("a");
    a.href = capturedThumbUrl;
    a.download = `capa-corte-${clip.position}.jpg`;
    a.click();
  };

  const handleSaveTrim = async () => {
    try {
      setIsSavingTrim(true);
      await onUpdateClipTime?.(clip.id, trimStart, trimEnd);
      onClose();
    } catch (err: any) {
      alert(`Falha ao solicitar ajuste: ${err?.message || "Tente novamente."}`);
    } finally {
      setIsSavingTrim(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "850px",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#0f172a",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          padding: "1.5rem",
        }}
      >
        {/* Cabeçalho do Modal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🎬</span> Editor Rápido do Corte #{clip.position}
            </h3>
            <span className="muted small">{clip.title}</span>
          </div>
          <button
            type="button"
            className="btn btn-small"
            style={{ background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", fontSize: "1.3rem" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Abas do Editor */}
        <div className="tabs" style={{ marginBottom: "1.2rem" }}>
          <button
            type="button"
            className={activeTab === "trim" ? "tab active" : "tab"}
            onClick={() => setActiveTab("trim")}
          >
            ✂️ Ajustar Corte (Trimming)
          </button>
          <button
            type="button"
            className={activeTab === "thumbnail" ? "tab active" : "tab"}
            onClick={() => {
              setActiveTab("thumbnail");
              setTimeout(captureFrame, 150);
            }}
          >
            📸 Capa / Thumbnail Viral
          </button>
          <button
            type="button"
            className={activeTab === "formats" ? "tab active" : "tab"}
            onClick={() => setActiveTab("formats")}
          >
            📐 Formatos & Proporção
          </button>
        </div>

        {/* Grid Principal: Player e Controles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
          {/* Player de Vídeo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#020617", borderRadius: "12px", padding: "0.75rem" }}>
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                onTimeUpdate={handleTimeUpdate}
                style={{
                  maxHeight: "360px",
                  maxWidth: "100%",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                }}
              />
            ) : (
              <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                Vídeo não carregado
              </div>
            )}
            <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#94a3b8" }}>
              Posição atual: <strong>{currentTime.toFixed(1)}s</strong> / {duration.toFixed(1)}s
            </div>
          </div>

          {/* Painel da Aba Ativa */}
          <div>
            {/* ABA 1: TRIMMING */}
            {activeTab === "trim" && (
              <div className="stack" style={{ gap: "1rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.3rem", fontSize: "1rem" }}>Ajuste Fino de Início e Término</h4>
                  <p className="muted small" style={{ margin: 0 }}>
                    Ajuste os segundos exatos para eliminar silêncios ou encaixar o ritmo perfeito.
                  </p>
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <label style={{ fontSize: "0.85rem", margin: 0 }}>
                      Segundo Inicial: <strong>{trimStart.toFixed(1)}s</strong>
                    </label>
                    <button type="button" className="btn btn-small btn-secondary" onClick={setStartToCurrent}>
                      Marcar no Player
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={trimEnd - 1}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--primary)" }}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", marginBottom: "0.4rem" }}>
                    <label style={{ fontSize: "0.85rem", margin: 0 }}>
                      Segundo Final: <strong>{trimEnd.toFixed(1)}s</strong>
                    </label>
                    <button type="button" className="btn btn-small btn-secondary" onClick={setEndToCurrent}>
                      Marcar no Player
                    </button>
                  </div>
                  <input
                    type="range"
                    min={trimStart + 1}
                    max={duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--primary)" }}
                  />

                  <div style={{ marginTop: "0.8rem", textAlign: "center", fontSize: "0.85rem", color: "var(--primary)" }}>
                    ⏱️ Nova Duração: <strong>{(trimEnd - trimStart).toFixed(1)} segundos</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={playSelectedRange}>
                    ▶️ Testar Trecho
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={handleSaveTrim}
                    disabled={isSavingTrim}
                  >
                    {isSavingTrim ? "⏳ Re-renderizando..." : "💾 Salvar Corte & Re-renderizar"}
                  </button>
                </div>
              </div>
            )}

            {/* ABA 2: THUMBNAIL / CAPA */}
            {activeTab === "thumbnail" && (
              <div className="stack" style={{ gap: "1rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.3rem", fontSize: "1rem" }}>Gerador de Capa de Alta Retenção</h4>
                  <p className="muted small" style={{ margin: 0 }}>
                    Pause o vídeo no melhor frame, personalize o título e baixe a capa pronta em 1080x1920.
                  </p>
                </div>

                <label style={{ fontSize: "0.85rem" }}>
                  Texto de Destaque na Capa:
                  <input
                    type="text"
                    value={thumbTitle}
                    onChange={(e) => setThumbTitle(e.target.value)}
                    style={{ marginTop: "0.25rem", fontSize: "0.88rem" }}
                  />
                </label>

                <div className="row" style={{ gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem" }}>Cor do Título:</span>
                  <button
                    type="button"
                    className="btn btn-small"
                    style={{ background: titleColor === "yellow" ? "#FFE600" : "#333", color: "#000" }}
                    onClick={() => setTitleColor("yellow")}
                  >
                    Amarelo
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    style={{ background: titleColor === "cyan" ? "#00F0FF" : "#333", color: "#000" }}
                    onClick={() => setTitleColor("cyan")}
                  >
                    Ciano
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    style={{ background: titleColor === "white" ? "#FFFFFF" : "#333", color: "#000" }}
                    onClick={() => setTitleColor("white")}
                  >
                    Branco
                  </button>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={captureFrame}>
                    📸 Capturar Frame Atual
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={downloadThumbnail}
                    disabled={!capturedThumbUrl}
                  >
                    <DownloadIcon size={16} /> Baixar Capa JPG
                  </button>
                </div>

                {/* Canvas Invisível para Renderização da Imagem */}
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            )}

            {/* ABA 3: FORMATOS */}
            {activeTab === "formats" && (
              <div className="stack" style={{ gap: "1rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.3rem", fontSize: "1rem" }}>Exportação em Múltiplos Formatos</h4>
                  <p className="muted small" style={{ margin: 0 }}>
                    Adapte seu corte para postagem multiplataforma com um clique.
                  </p>
                </div>

                <div className="stack" style={{ gap: "0.5rem" }}>
                  <div style={{ padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.9rem" }}>📱 9:16 Vertical (Original)</strong>
                      <span className="muted small">TikTok, Instagram Reels, YouTube Shorts</span>
                    </div>
                    <span className="badge badge-done" style={{ fontSize: "0.75rem" }}>Pronto</span>
                  </div>

                  <div style={{ padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.9rem" }}>⬛ 1:1 Quadrado</strong>
                      <span className="muted small">Feed do Instagram, LinkedIn, Facebook</span>
                    </div>
                    <span className="badge" style={{ background: "rgba(255,255,255,0.1)", fontSize: "0.75rem" }}>Compatível</span>
                  </div>

                  <div style={{ padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.9rem" }}>🖥️ 16:9 Widescreen</strong>
                      <span className="muted small">YouTube Tradicional, Twitter / X</span>
                    </div>
                    <span className="badge" style={{ background: "rgba(255,255,255,0.1)", fontSize: "0.75rem" }}>Compatível</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
