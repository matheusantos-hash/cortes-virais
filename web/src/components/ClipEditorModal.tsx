"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { Clip, CanvasBroll, CanvasBrollTemplate } from "@/lib/types";
import CanvasBrollOverlay from "./CanvasBrollOverlay";
import { detectBrollTriggers, type BrollTriggerSuggestion } from "@/lib/detectBrollTriggers";
import {
  DownloadIcon,
  SparklesIcon,
  XIcon,
  TrendingUpIcon,
  Film,
  Scissors,
  Camera,
  Crop,
  Clock,
  Play,
  Save,
  Smartphone,
  Square,
  Monitor,
} from "./Icons";

interface ClipEditorModalProps {
  clip: Clip;
  videoSrc?: string;
  onClose: () => void;
  onUpdateClipTime?: (clipId: string, trimStart: number, trimEnd: number, canvasBrolls?: CanvasBroll[]) => Promise<void> | void;
  onSaveCanvasBrolls?: (clipId: string, brolls: CanvasBroll[]) => Promise<void> | void;
}

export default function ClipEditorModal({
  clip,
  videoSrc,
  onClose,
  onUpdateClipTime,
  onSaveCanvasBrolls,
}: ClipEditorModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const duration = Math.max(1, Number(clip.end_seconds) - Number(clip.start_seconds));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(duration);
  const [activeTab, setActiveTab] = useState<"trim" | "brolls" | "thumbnail" | "formats">("brolls");
  const [isSavingTrim, setIsSavingTrim] = useState(false);
  const [isSavingBrolls, setIsSavingBrolls] = useState(false);

  // Estados de B-Rolls Canvas & Overlays
  const [canvasBrolls, setCanvasBrolls] = useState<CanvasBroll[]>(clip.canvas_brolls || []);
  const [enableBrollOverlay, setEnableBrollOverlay] = useState(true);

  // Estados da Capa / Thumbnail
  const [thumbTitle, setThumbTitle] = useState(clip.title);
  const [titleColor, setTitleColor] = useState<"yellow" | "white" | "cyan">("yellow");
  const [capturedThumbUrl, setCapturedThumbUrl] = useState<string | null>(null);

  // Detecta gatilhos automáticos na fala do corte
  const suggestions = useMemo<BrollTriggerSuggestion[]>(() => {
    return detectBrollTriggers(clip.edit_decisions?.words, clip.start_seconds, clip.end_seconds);
  }, [clip.edit_decisions?.words, clip.start_seconds, clip.end_seconds]);

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

  const jumpToTime = (t: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, t));
    videoRef.current.play();
  };

  // Interação na Timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = Number((pct * duration).toFixed(1));
    videoRef.current.currentTime = targetSec;
    setCurrentTime(targetSec);
  };

  // Adiciona B-Roll a partir de sugestão da IA
  const addFromSuggestion = (s: BrollTriggerSuggestion) => {
    const newBroll: CanvasBroll = {
      id: "broll-" + Date.now(),
      offsetSec: s.offsetSec,
      durationSec: s.durationSec,
      template: s.template,
      data: {
        title: s.suggestedTitle,
        value: s.suggestedValue,
        subtitle: s.suggestedSubtitle,
        color: s.suggestedColor,
        positionY: "top",
      },
    };
    setCanvasBrolls((prev) => [...prev, newBroll]);
    jumpToTime(s.offsetSec);
  };

  // Adiciona B-Roll no segundo atual
  const addBrollAtCurrentTime = (template: CanvasBrollTemplate = "metric_counter") => {
    const offset = Number(currentTime.toFixed(1));
    const newBroll: CanvasBroll = {
      id: "broll-" + Date.now(),
      offsetSec: offset,
      durationSec: 3.0,
      template,
      data: {
        title: template === "growth_chart" ? "CRESCIMENTO" : template === "glass_alert" ? "ATENÇÃO" : "DESTAQUE VIRAL",
        value: template === "metric_counter" ? "+300%" : template === "growth_chart" ? "+450%" : "IMPORTANTE",
        subtitle: "Elemento de alta retenção",
        color: template === "growth_chart" ? "green" : "cyan",
        positionY: "top",
      },
    };
    setCanvasBrolls((prev) => [...prev, newBroll]);
    jumpToTime(offset);
  };

  const removeBroll = (id: string) => {
    setCanvasBrolls((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBroll = (id: string, partial: Partial<CanvasBroll>) => {
    setCanvasBrolls((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...partial, data: { ...b.data, ...(partial.data || {}) } } : b))
    );
  };

  // Salvar B-Rolls no Banco de Dados
  const handleSaveBrolls = async () => {
    try {
      setIsSavingBrolls(true);
      await onSaveCanvasBrolls?.(clip.id, canvasBrolls);
      alert("B-Rolls Canvas salvos com sucesso!");
    } catch (err: any) {
      alert(`Falha ao salvar: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setIsSavingBrolls(false);
    }
  };

  // Salvar e Re-renderizar com Trimming e B-Rolls
  const handleSaveTrimAndBrolls = async () => {
    try {
      setIsSavingTrim(true);
      await onUpdateClipTime?.(clip.id, trimStart, trimEnd, canvasBrolls);
      onClose();
    } catch (err: any) {
      alert(`Falha ao solicitar ajuste: ${err?.message || "Tente novamente."}`);
    } finally {
      setIsSavingTrim(false);
    }
  };

  // Captura um frame do vídeo para criar a thumbnail estilizada
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1920;

    ctx.drawImage(video, 0, 0, 1080, 1920);

    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
    grad.addColorStop(0.25, "rgba(0, 0, 0, 0)");
    grad.addColorStop(0.65, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const text = thumbTitle.toUpperCase();
    ctx.font = "900 68px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let fillHex = "#FFE600";
    if (titleColor === "white") fillHex = "#FFFFFF";
    if (titleColor === "cyan") fillHex = "#00F0FF";

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 14;
    ctx.lineJoin = "round";

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

    ctx.fillStyle = "#6366F1";
    ctx.beginPath();
    ctx.roundRect(400, 168, 280, 56, 28);
    ctx.fill();

    ctx.font = "800 24px Arial, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("★ TOP VIRAL", 540, 204);

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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.88)",
        backdropFilter: "blur(8px)",
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
          maxWidth: "960px",
          maxHeight: "94vh",
          overflowY: "auto",
          background: "#0b0f19",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.8)",
          padding: "1.5rem",
          borderRadius: "16px",
        }}
      >
        {/* Cabeçalho do Modal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Film size={20} style={{ color: "var(--primary)" }} /> Editor Avançado do Corte #{clip.position}
            </h3>
            <span className="muted small">{clip.title}</span>
          </div>
          <button
            type="button"
            className="btn btn-small"
            style={{ background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.3rem" }}
            onClick={onClose}
            title="Fechar"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Abas do Editor */}
        <div className="tabs" style={{ marginBottom: "1.2rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={activeTab === "brolls" ? "tab active" : "tab"}
            onClick={() => setActiveTab("brolls")}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: 600 }}
          >
            <SparklesIcon size={15} style={{ color: "#00F0FF" }} /> ⚡ B-Rolls &amp; Motion
            {canvasBrolls.length > 0 && (
              <span style={{ background: "#00F0FF", color: "#000", fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: "10px", fontWeight: 800 }}>
                {canvasBrolls.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={activeTab === "trim" ? "tab active" : "tab"}
            onClick={() => setActiveTab("trim")}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <Scissors size={14} /> Ajustar Corte (Trimming)
          </button>
          <button
            type="button"
            className={activeTab === "thumbnail" ? "tab active" : "tab"}
            onClick={() => {
              setActiveTab("thumbnail");
              setTimeout(captureFrame, 150);
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <Camera size={14} /> Capa / Thumbnail Viral
          </button>
          <button
            type="button"
            className={activeTab === "formats" ? "tab active" : "tab"}
            onClick={() => setActiveTab("formats")}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <Crop size={14} /> Formatos &amp; Proporção
          </button>
        </div>

        {/* Grid Principal: Player e Controles */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: "1.5rem", alignItems: "start" }}>
          {/* COLUNA ESQUERDA: PLAYER + TIMELINE ESTILO CAPCUT */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {/* Player de Vídeo com Camada de Canvas Overlay */}
            <div
              style={{
                position: "relative",
                background: "#020617",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                aspectRatio: "9/16",
                maxHeight: "380px",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {videoSrc ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    controls
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                  {/* Camada Dinâmica de B-Rolls Canvas em Tempo Real */}
                  {enableBrollOverlay && (
                    <CanvasBrollOverlay
                      brolls={canvasBrolls}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                    />
                  )}
                </>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Vídeo não carregado</div>
              )}
            </div>

            {/* Alternador de Overlay no Player */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#94a3b8" }}>
              <span>
                Tempo: <strong style={{ color: "#fff" }}>{currentTime.toFixed(1)}s</strong> / {duration.toFixed(1)}s
              </span>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setEnableBrollOverlay(!enableBrollOverlay)}
                style={{
                  background: enableBrollOverlay ? "rgba(0, 240, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  color: enableBrollOverlay ? "#00F0FF" : "#64748b",
                  border: `1px solid ${enableBrollOverlay ? "#00F0FF" : "rgba(255,255,255,0.1)"}`,
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.75rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {enableBrollOverlay ? "⚡ Preview Canvas Ativo" : "Preview Canvas Desligado"}
              </button>
            </div>

            {/* TIMELINE INTERATIVA (CAPCUT STYLE) */}
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "0.75rem", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b", marginBottom: "0.4rem" }}>
                <span>0.0s</span>
                <span style={{ color: "#a855f7", fontWeight: 600 }}>Linha do Tempo de Efeitos</span>
                <span>{duration.toFixed(1)}s</span>
              </div>

              {/* Trilho da Timeline */}
              <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                style={{
                  position: "relative",
                  height: "36px",
                  background: "#030712",
                  borderRadius: "6px",
                  cursor: "pointer",
                  overflow: "hidden",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                {/* B-Rolls Ativos marcados como blocos coloridos */}
                {canvasBrolls.map((b) => {
                  const leftPct = (b.offsetSec / duration) * 100;
                  const widthPct = (b.durationSec / duration) * 100;
                  return (
                    <div
                      key={b.id}
                      style={{
                        position: "absolute",
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: 0,
                        bottom: 0,
                        background: "rgba(0, 240, 255, 0.4)",
                        borderLeft: "2px solid #00F0FF",
                        borderRight: "2px solid #00F0FF",
                        zIndex: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.65rem",
                        color: "#fff",
                        fontWeight: 700,
                        textShadow: "0 1px 2px #000",
                        pointerEvents: "none",
                      }}
                    >
                      B-ROLL
                    </div>
                  );
                })}

                {/* Marcadores / Pins de Sugestões da IA */}
                {suggestions.map((s, idx) => {
                  const leftPct = (s.offsetSec / duration) * 100;
                  return (
                    <div
                      key={idx}
                      title={`Sugestão IA (${s.offsetSec}s): ${s.suggestedTitle}`}
                      style={{
                        position: "absolute",
                        left: `${leftPct}%`,
                        top: 0,
                        bottom: 0,
                        width: "3px",
                        background: "#FFE600",
                        boxShadow: "0 0 8px #FFE600",
                        zIndex: 3,
                        pointerEvents: "none",
                      }}
                    />
                  );
                })}

                {/* Agulha de Reprodução (Scrubber) */}
                <div
                  style={{
                    position: "absolute",
                    left: `${(currentTime / duration) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: "2px",
                    background: "#ef4444",
                    boxShadow: "0 0 6px #ef4444",
                    zIndex: 4,
                    pointerEvents: "none",
                  }}
                />
              </div>

              {/* Botão Rápido para Inserir na Posição Atual */}
              <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.4rem" }}>
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  style={{ flex: 1, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
                  onClick={() => addBrollAtCurrentTime("metric_counter")}
                >
                  + Inserir Contador ({currentTime.toFixed(1)}s)
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  style={{ flex: 1, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
                  onClick={() => addBrollAtCurrentTime("growth_chart")}
                >
                  + Inserir Gráfico ({currentTime.toFixed(1)}s)
                </button>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: PAINEL DA ABA ATIVA */}
          <div>
            {/* ABA: B-ROLLS & MOTION */}
            {activeTab === "brolls" && (
              <div className="stack" style={{ gap: "1rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.3rem", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <SparklesIcon size={16} style={{ color: "#00F0FF" }} /> B-Rolls Inteligentes em Canvas
                  </h4>
                  <p className="muted small" style={{ margin: 0 }}>
                    Adicione motion graphics baseados em código para aumentar a retenção visual no momento chave.
                  </p>
                </div>

                {/* Sugestões da IA com 1 Clique */}
                {suggestions.length > 0 && (
                  <div style={{ background: "rgba(255, 230, 0, 0.05)", padding: "0.8rem", borderRadius: "8px", border: "1px solid rgba(255, 230, 0, 0.2)" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#FFE600", display: "block", marginBottom: "0.5rem" }}>
                      💡 Sugestões Identificadas na Transcrição:
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "150px", overflowY: "auto" }}>
                      {suggestions.map((s, idx) => {
                        const isAdded = canvasBrolls.some((b) => Math.abs(b.offsetSec - s.offsetSec) < 0.5);
                        return (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "rgba(0, 0, 0, 0.4)",
                              padding: "0.4rem 0.6rem",
                              borderRadius: "6px",
                              fontSize: "0.8rem",
                            }}
                          >
                            <div>
                              <strong style={{ color: "#fff" }}>{s.offsetSec}s</strong>: {s.suggestedTitle} (
                              <span style={{ color: "#00F0FF" }}>{s.suggestedValue}</span>)
                            </div>
                            <div style={{ display: "flex", gap: "0.3rem" }}>
                              <button
                                type="button"
                                className="btn btn-small"
                                style={{ padding: "0.2rem 0.4rem", fontSize: "0.7rem", background: "rgba(255,255,255,0.1)", color: "#fff" }}
                                onClick={() => jumpToTime(s.offsetSec)}
                              >
                                Tocar
                              </button>
                              <button
                                type="button"
                                className="btn btn-small btn-primary"
                                style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
                                disabled={isAdded}
                                onClick={() => addFromSuggestion(s)}
                              >
                                {isAdded ? "Ativo" : "+ Adicionar"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lista de B-Rolls Ativos */}
                <div style={{ maxHeight: "230px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Overlays Ativos ({canvasBrolls.length}):</span>
                  {canvasBrolls.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.1)", color: "#64748b", fontSize: "0.85rem" }}>
                      Nenhum B-Roll Canvas adicionado. Clique nas sugestões da IA acima ou no botão abaixo da timeline.
                    </div>
                  ) : (
                    canvasBrolls.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          background: "rgba(255, 255, 255, 0.04)",
                          padding: "0.75rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.4rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ background: "#00F0FF", color: "#000", fontWeight: 800, fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                              {b.offsetSec.toFixed(1)}s
                            </span>
                            <strong style={{ fontSize: "0.85rem" }}>{b.data.title || "B-Roll"}</strong>
                          </div>
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <button
                              type="button"
                              className="btn btn-small"
                              style={{ padding: "0.2rem 0.4rem", fontSize: "0.7rem", background: "rgba(255,255,255,0.1)", color: "#fff" }}
                              onClick={() => jumpToTime(b.offsetSec)}
                            >
                              Ver
                            </button>
                            <button
                              type="button"
                              className="btn btn-small"
                              style={{ padding: "0.2rem 0.4rem", fontSize: "0.7rem", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "none" }}
                              onClick={() => removeBroll(b.id)}
                            >
                              Remover
                            </button>
                          </div>
                        </div>

                        {/* Controles de Edição Rápida */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                          <label style={{ fontSize: "0.75rem", margin: 0 }}>
                            Tipo:
                            <select
                              value={b.template}
                              onChange={(e) => updateBroll(b.id, { template: e.target.value as CanvasBrollTemplate })}
                              style={{ width: "100%", padding: "0.25rem", fontSize: "0.75rem", marginTop: "0.2rem" }}
                            >
                              <option value="metric_counter">Contador de Métrica</option>
                              <option value="growth_chart">Gráfico de Crescimento</option>
                              <option value="glass_alert">Alerta Glassmorphism</option>
                              <option value="viral_tag">Tag Viral</option>
                            </select>
                          </label>

                          <label style={{ fontSize: "0.75rem", margin: 0 }}>
                            Valor de Destaque:
                            <input
                              type="text"
                              value={b.data.value || ""}
                              onChange={(e) => updateBroll(b.id, { data: { ...b.data, value: e.target.value } })}
                              style={{ width: "100%", padding: "0.25rem", fontSize: "0.75rem", marginTop: "0.2rem" }}
                            />
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Botões de Ação */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                    onClick={handleSaveBrolls}
                    disabled={isSavingBrolls}
                  >
                    <Save size={14} /> {isSavingBrolls ? "Salvando..." : "Salvar no Corte"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                    onClick={handleSaveTrimAndBrolls}
                    disabled={isSavingTrim}
                  >
                    <SparklesIcon size={14} /> {isSavingTrim ? "Renderizando..." : "Re-renderizar Vídeo Final"}
                  </button>
                </div>
              </div>
            )}

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

                  <div style={{ marginTop: "0.8rem", textAlign: "center", fontSize: "0.85rem", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                    <Clock size={14} /> Nova Duração: <strong>{(trimEnd - trimStart).toFixed(1)} segundos</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }} onClick={playSelectedRange}>
                    <Play size={14} /> Testar Trecho
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                    onClick={handleSaveTrimAndBrolls}
                    disabled={isSavingTrim}
                  >
                    {isSavingTrim ? (
                      <>
                        <Clock size={14} /> Re-renderizando...
                      </>
                    ) : (
                      <>
                        <Save size={14} /> Salvar Corte &amp; Re-renderizar
                      </>
                    )}
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
                  <button type="button" className="btn btn-secondary" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }} onClick={captureFrame}>
                    <Camera size={14} /> Capturar Frame Atual
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
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
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.9rem" }}>
                        <Smartphone size={14} /> 9:16 Vertical (Original)
                      </strong>
                      <span className="muted small">TikTok, Instagram Reels, YouTube Shorts</span>
                    </div>
                    <span className="badge badge-done" style={{ fontSize: "0.75rem" }}>Pronto</span>
                  </div>

                  <div style={{ padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.9rem" }}>
                        <Square size={14} /> 1:1 Quadrado
                      </strong>
                      <span className="muted small">Feed do Instagram, LinkedIn, Facebook</span>
                    </div>
                    <span className="badge" style={{ background: "rgba(255,255,255,0.1)", fontSize: "0.75rem" }}>Compatível</span>
                  </div>

                  <div style={{ padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.9rem" }}>
                        <Monitor size={14} /> 16:9 Widescreen
                      </strong>
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
