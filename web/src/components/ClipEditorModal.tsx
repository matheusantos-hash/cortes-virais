"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Clip, CanvasBroll, CanvasBrollTemplate } from "@/lib/types";
import CanvasBrollOverlay from "./CanvasBrollOverlay";
import { detectBrollTriggers, type BrollTriggerSuggestion } from "@/lib/detectBrollTriggers";
import {
  DownloadIcon,
  SparklesIcon,
  XIcon,
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
  Trash2,
  SlidersHorizontal,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  EyeIcon,
  EyeOffIcon,
  Lightbulb,
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
  const timelineTracksRef = useRef<HTMLDivElement>(null);

  const duration = Math.max(1, Number(clip.end_seconds) - Number(clip.start_seconds));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(duration);
  const [activeTab, setActiveTab] = useState<"brolls" | "trim" | "thumbnail" | "formats">("brolls");
  const [isSavingTrim, setIsSavingTrim] = useState(false);
  const [isSavingBrolls, setIsSavingBrolls] = useState(false);

  // Estados de B-Rolls Canvas & Overlays
  const [canvasBrolls, setCanvasBrolls] = useState<CanvasBroll[]>(clip.canvas_brolls || []);
  const [selectedBrollId, setSelectedBrollId] = useState<string | null>(
    clip.canvas_brolls && clip.canvas_brolls.length > 0 ? clip.canvas_brolls[0].id : null
  );
  const [enableBrollOverlay, setEnableBrollOverlay] = useState(true);

  // Estados do Player & Safe Zones CapCut
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [zoomScale, setZoomScale] = useState<number>(1); // 1x, 1.5x, 2x

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

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const seekRelative = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  }, [duration]);

  // Atalhos de teclado (Espaço = Play/Pause, Setas = +/- 1s, Esc = Fechar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora atalhos se o usuário estiver digitando em um input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekRelative(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekRelative(1);
      } else if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekRelative, onClose]);

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
    setIsPlaying(true);
  };

  const jumpToTime = (t: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, t));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    videoRef.current.play();
    setIsPlaying(true);
  };

  // Interação na Timeline Multitrack
  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineTracksRef.current || !videoRef.current) return;
    const rect = timelineTracksRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = Number((pct * duration).toFixed(1));
    videoRef.current.currentTime = targetSec;
    setCurrentTime(targetSec);
  };

  // Adiciona B-Roll a partir de sugestão da IA
  const addFromSuggestion = (s: BrollTriggerSuggestion) => {
    const newId = "broll-" + Date.now();
    const newBroll: CanvasBroll = {
      id: newId,
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
    setSelectedBrollId(newId);
    jumpToTime(s.offsetSec);
  };

  // Adiciona B-Roll no segundo atual
  const addBrollAtCurrentTime = (template: CanvasBrollTemplate = "metric_counter") => {
    const offset = Number(currentTime.toFixed(1));
    const newId = "broll-" + Date.now();
    const newBroll: CanvasBroll = {
      id: newId,
      offsetSec: offset,
      durationSec: 3.0,
      template,
      data: {
        title: template === "growth_chart" ? "CRESCIMENTO" : template === "glass_alert" ? "ATENÇÃO" : "DESTAQUE VIRAL",
        value: template === "metric_counter" ? "+300%" : template === "growth_chart" ? "+450%" : "IMPORTANTE",
        subtitle: "Elemento de retenção CapCut",
        color: template === "growth_chart" ? "green" : "cyan",
        positionY: "top",
      },
    };
    setCanvasBrolls((prev) => [...prev, newBroll]);
    setSelectedBrollId(newId);
    jumpToTime(offset);
  };

  const removeBroll = (id: string) => {
    setCanvasBrolls((prev) => prev.filter((b) => b.id !== id));
    if (selectedBrollId === id) {
      setSelectedBrollId(null);
    }
  };

  const updateBroll = (id: string, partial: Partial<CanvasBroll>) => {
    setCanvasBrolls((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...partial, data: { ...b.data, ...(partial.data || {}) } } : b))
    );
  };

  const selectedBroll = useMemo(() => {
    return canvasBrolls.find((b) => b.id === selectedBrollId) || null;
  }, [canvasBrolls, selectedBrollId]);

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

  // Enviar clipe diretamente para o Clone Studio
  const handleSendToCloneStudio = () => {
    if (!clip.file_path) {
      alert("Aguarde a finalização do processamento do corte para enviá-lo ao Clone Studio.");
      return;
    }
    const isHorizontal = videoRef.current ? videoRef.current.videoWidth > videoRef.current.videoHeight : false;
    const clipData = {
      id: clip.id,
      title: clip.title,
      path: clip.file_path,
      url: videoSrc,
      position: clip.position,
      orientation: isHorizontal ? "horizontal" : "vertical",
    };
    try {
      sessionStorage.setItem("clone_source_clip", JSON.stringify(clipData));
    } catch {}
    window.location.href = "/?mode=copiar_estilo&fromClip=1";
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

  // Formatação de Timecode (00:14.2)
  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    return `${String(mins).padStart(2, "0")}:${secs.padStart(4, "0")}`;
  };

  // Gera marcações da régua de tempo
  const rulerMarks = useMemo(() => {
    const step = duration > 60 ? 5 : duration > 25 ? 2 : 1;
    const marks: number[] = [];
    for (let t = 0; t <= duration; t += step) {
      marks.push(t);
    }
    return marks;
  }, [duration]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#0B0D13",
        color: "#F3F4F6",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* 1. HEADER DO ESTÚDIO CAPCUT */}
      <header
        style={{
          height: "54px",
          backgroundColor: "#12151D",
          borderBottom: "1px solid #232733",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1rem",
          gap: "1rem",
          zIndex: 10,
        }}
      >
        {/* Esquerda: Voltar e Identificação do Corte */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-small"
            style={{
              background: "#1C202B",
              border: "1px solid #2C3242",
              color: "#F3F4F6",
              padding: "0.35rem 0.65rem",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.82rem",
              fontWeight: 600,
            }}
            title="Voltar para a lista de cortes (Esc)"
          >
            <ArrowLeft size={15} /> Voltar
          </button>

          <div style={{ height: "18px", width: "1px", background: "#2C3242" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                background: "linear-gradient(135deg, #6366F1, #A855F7)",
                color: "#FFF",
                padding: "0.15rem 0.5rem",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 800,
                letterSpacing: "0.02em",
              }}
            >
              #{clip.position}
            </span>
            <span
              style={{
                fontSize: "0.92rem",
                fontWeight: 700,
                maxWidth: "340px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "#F3F4F6",
              }}
            >
              {clip.title}
            </span>
          </div>
        </div>

        {/* Centro: Timecode Digital Monospace & Safe Zones Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              background: "#08090D",
              border: "1px solid #232733",
              padding: "0.25rem 0.75rem",
              borderRadius: "8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.85rem",
              color: "#00F0FF",
              fontWeight: 600,
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <span style={{ color: "#FFF" }}>{formatTimecode(currentTime)}</span>
            <span style={{ color: "#64748B" }}>/</span>
            <span style={{ color: "#94A3B8" }}>{formatTimecode(duration)}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowSafeZones(!showSafeZones)}
            style={{
              background: showSafeZones ? "rgba(0, 240, 255, 0.12)" : "#1C202B",
              color: showSafeZones ? "#00F0FF" : "#94A3B8",
              border: `1px solid ${showSafeZones ? "rgba(0, 240, 255, 0.4)" : "#2C3242"}`,
              padding: "0.3rem 0.65rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.76rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "all 0.15s ease",
            }}
            title="Alternar Safe Zones de TikTok / Reels / Shorts"
          >
            {showSafeZones ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
            Safe Zones {showSafeZones ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={() => setEnableBrollOverlay(!enableBrollOverlay)}
            style={{
              background: enableBrollOverlay ? "rgba(168, 85, 247, 0.15)" : "#1C202B",
              color: enableBrollOverlay ? "#C084FC" : "#94A3B8",
              border: `1px solid ${enableBrollOverlay ? "rgba(168, 85, 247, 0.4)" : "#2C3242"}`,
              padding: "0.3rem 0.65rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.76rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "all 0.15s ease",
            }}
            title="Ativar/Desativar Prévia de Motion Graphics Canvas"
          >
            <SparklesIcon size={14} /> Overlays {enableBrollOverlay ? "ON" : "OFF"}
          </button>
        </div>

        {/* Direita: Ações de Salvar e Fechar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={handleSendToCloneStudio}
            style={{
              background: "rgba(0, 240, 255, 0.12)",
              border: "1px solid rgba(0, 240, 255, 0.4)",
              color: "#00F0FF",
              padding: "0.4rem 0.8rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "all 0.15s ease",
            }}
            title="Enviar este corte diretamente para o Clone Studio (aplicar clonagem de ritmo e IA)"
          >
            <SparklesIcon size={14} /> Clonar Estilo
          </button>

          <button
            type="button"
            onClick={handleSaveBrolls}
            disabled={isSavingBrolls}
            style={{
              background: "#1C202B",
              border: "1px solid #2C3242",
              color: "#F3F4F6",
              padding: "0.4rem 0.8rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <Save size={14} /> {isSavingBrolls ? "Salvando..." : "Salvar Overlays"}
          </button>

          <button
            type="button"
            onClick={handleSaveTrimAndBrolls}
            disabled={isSavingTrim}
            style={{
              background: "linear-gradient(135deg, #4F46E5, #06B6D4)",
              border: "none",
              color: "#FFF",
              padding: "0.45rem 1rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.84rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              boxShadow: "0 2px 10px rgba(6, 182, 212, 0.3)",
            }}
          >
            <SparklesIcon size={15} /> {isSavingTrim ? "Renderizando..." : "Re-renderizar Corte"}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "0.35rem",
              display: "flex",
              alignItems: "center",
            }}
            title="Fechar Estúdio"
          >
            <XIcon size={18} />
          </button>
        </div>
      </header>

      {/* 2. ÁREA DE TRABALHO PRINCIPAL (3 COLUNAS FIXAS) */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "300px 1fr 280px",
          overflow: "hidden",
          backgroundColor: "#0D0F16",
        }}
      >
        {/* COLUNA ESQUERDA: BIBLIOTECA DE RECURSOS E ABAS */}
        <aside
          style={{
            backgroundColor: "#13161F",
            borderRight: "1px solid #212634",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Navegação por Abas Verticais/Pills estilo CapCut */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #212634",
              background: "#10121A",
              padding: "0.4rem",
              gap: "0.3rem",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("brolls")}
              style={{
                flex: 1,
                padding: "0.45rem 0.3rem",
                borderRadius: "6px",
                fontSize: "0.76rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "brolls" ? "#1E2230" : "transparent",
                color: activeTab === "brolls" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <SparklesIcon size={15} />
              <span>B-Rolls</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("trim")}
              style={{
                flex: 1,
                padding: "0.45rem 0.3rem",
                borderRadius: "6px",
                fontSize: "0.76rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "trim" ? "#1E2230" : "transparent",
                color: activeTab === "trim" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Scissors size={15} />
              <span>Corte</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("thumbnail");
                setTimeout(captureFrame, 150);
              }}
              style={{
                flex: 1,
                padding: "0.45rem 0.3rem",
                borderRadius: "6px",
                fontSize: "0.76rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "thumbnail" ? "#1E2230" : "transparent",
                color: activeTab === "thumbnail" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Camera size={15} />
              <span>Capa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("formats")}
              style={{
                flex: 1,
                padding: "0.45rem 0.3rem",
                borderRadius: "6px",
                fontSize: "0.76rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "formats" ? "#1E2230" : "transparent",
                color: activeTab === "formats" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Crop size={15} />
              <span>Formatos</span>
            </button>
          </div>

          {/* Conteúdo da Aba */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem" }}>
            {activeTab === "brolls" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
                    Inserir Motion no Playhead
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
                    Adicione animações de retenção no segundo exato ({currentTime.toFixed(1)}s):
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
                  <button
                    type="button"
                    onClick={() => addBrollAtCurrentTime("metric_counter")}
                    style={{
                      padding: "0.5rem 0.4rem",
                      borderRadius: "6px",
                      background: "#1A1D27",
                      border: "1px solid #2B3042",
                      color: "#00F0FF",
                      cursor: "pointer",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    + Contador (+300%)
                  </button>

                  <button
                    type="button"
                    onClick={() => addBrollAtCurrentTime("growth_chart")}
                    style={{
                      padding: "0.5rem 0.4rem",
                      borderRadius: "6px",
                      background: "#1A1D27",
                      border: "1px solid #2B3042",
                      color: "#10B981",
                      cursor: "pointer",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    + Gráfico de Alta
                  </button>

                  <button
                    type="button"
                    onClick={() => addBrollAtCurrentTime("glass_alert")}
                    style={{
                      padding: "0.5rem 0.4rem",
                      borderRadius: "6px",
                      background: "#1A1D27",
                      border: "1px solid #2B3042",
                      color: "#F59E0B",
                      cursor: "pointer",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    + Alerta Glass
                  </button>

                  <button
                    type="button"
                    onClick={() => addBrollAtCurrentTime("viral_tag")}
                    style={{
                      padding: "0.5rem 0.4rem",
                      borderRadius: "6px",
                      background: "#1A1D27",
                      border: "1px solid #2B3042",
                      color: "#C084FC",
                      cursor: "pointer",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    + Tag Viral
                  </button>
                </div>

                {/* Sugestões da IA */}
                {suggestions.length > 0 && (
                  <div
                    style={{
                      background: "rgba(255, 230, 0, 0.05)",
                      padding: "0.65rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 230, 0, 0.2)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "#FFE600",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "0.4rem",
                      }}
                    >
                      <Lightbulb size={14} style={{ color: "#FFE600" }} />
                      Sugestões Identificadas pela IA:
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "160px", overflowY: "auto" }}>
                      {suggestions.map((s, idx) => {
                        const isAdded = canvasBrolls.some((b) => Math.abs(b.offsetSec - s.offsetSec) < 0.5);
                        return (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "#0E1017",
                              padding: "0.35rem 0.5rem",
                              borderRadius: "5px",
                              fontSize: "0.74rem",
                            }}
                          >
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                              <strong style={{ color: "#00F0FF" }}>{s.offsetSec}s</strong>: {s.suggestedTitle}
                            </div>
                            <button
                              type="button"
                              disabled={isAdded}
                              onClick={() => addFromSuggestion(s)}
                              style={{
                                padding: "0.2rem 0.45rem",
                                borderRadius: "4px",
                                border: "none",
                                background: isAdded ? "#262C3A" : "#6366F1",
                                color: isAdded ? "#94A3B8" : "#FFF",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                cursor: isAdded ? "default" : "pointer",
                              }}
                            >
                              {isAdded ? "Ativo" : "+ Add"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lista de B-Rolls Adicionados */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8" }}>
                      Camadas na Timeline ({canvasBrolls.length}):
                    </span>
                  </div>

                  {canvasBrolls.length === 0 ? (
                    <div
                      style={{
                        padding: "1rem",
                        textAlign: "center",
                        background: "#161924",
                        borderRadius: "8px",
                        border: "1px dashed #2A3042",
                        color: "#64748B",
                        fontSize: "0.75rem",
                      }}
                    >
                      Nenhum B-Roll adicionado ainda.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "200px", overflowY: "auto" }}>
                      {canvasBrolls.map((b) => {
                        const isSelected = b.id === selectedBrollId;
                        return (
                          <div
                            key={b.id}
                            onClick={() => {
                              setSelectedBrollId(b.id);
                              jumpToTime(b.offsetSec);
                            }}
                            style={{
                              background: isSelected ? "rgba(0, 240, 255, 0.12)" : "#171A25",
                              border: `1px solid ${isSelected ? "#00F0FF" : "#262B3B"}`,
                              borderRadius: "6px",
                              padding: "0.5rem",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                <span style={{ background: "#00F0FF", color: "#000", fontSize: "0.65rem", padding: "0.08rem 0.3rem", borderRadius: "3px", fontWeight: 800 }}>
                                  {b.offsetSec.toFixed(1)}s
                                </span>
                                <strong style={{ fontSize: "0.78rem", color: "#FFF" }}>{b.data.title || "B-Roll"}</strong>
                              </div>
                              <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>Duração: {b.durationSec}s</span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBroll(b.id);
                              }}
                              style={{
                                background: "rgba(239, 68, 68, 0.2)",
                                color: "#EF4444",
                                border: "none",
                                borderRadius: "4px",
                                padding: "0.25rem 0.35rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                              }}
                              title="Remover B-Roll"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: AJUSTE DE CORTE (TRIMMING) */}
            {activeTab === "trim" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
                    Ajuste Fino Milimétrico
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
                    Corte início e fim com precisão para ritmo perfeito de retenção:
                  </p>
                </div>

                <div style={{ background: "#171A25", padding: "0.75rem", borderRadius: "8px", border: "1px solid #262B3B" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.78rem" }}>Início: <strong style={{ color: "#00F0FF" }}>{trimStart.toFixed(1)}s</strong></span>
                    <button
                      type="button"
                      onClick={setStartToCurrent}
                      style={{
                        padding: "0.2rem 0.45rem",
                        borderRadius: "4px",
                        background: "#262C3A",
                        border: "none",
                        color: "#FFF",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                      }}
                    >
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
                    style={{ width: "100%", accentColor: "#6366F1" }}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.8rem", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.78rem" }}>Fim: <strong style={{ color: "#00F0FF" }}>{trimEnd.toFixed(1)}s</strong></span>
                    <button
                      type="button"
                      onClick={setEndToCurrent}
                      style={{
                        padding: "0.2rem 0.45rem",
                        borderRadius: "4px",
                        background: "#262C3A",
                        border: "none",
                        color: "#FFF",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                      }}
                    >
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
                    style={{ width: "100%", accentColor: "#6366F1" }}
                  />

                  <div style={{ marginTop: "0.75rem", textAlign: "center", fontSize: "0.76rem", color: "#A855F7", fontWeight: 700 }}>
                    Nova Duração: {(trimEnd - trimStart).toFixed(1)} segundos
                  </div>
                </div>

                <button
                  type="button"
                  onClick={playSelectedRange}
                  style={{
                    background: "#1E2333",
                    border: "1px solid #31384E",
                    color: "#FFF",
                    padding: "0.5rem",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                  }}
                >
                  <Play size={14} /> Testar Trecho Recortado
                </button>
              </div>
            )}

            {/* ABA: CAPA / THUMBNAIL */}
            {activeTab === "thumbnail" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
                    Gerador de Capa Viral (1080x1920)
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
                    Capture o frame mais expressivo e aplique tipografia chamativa:
                  </p>
                </div>

                <div>
                  <label style={{ fontSize: "0.76rem", color: "#94A3B8", display: "block", marginBottom: "0.25rem" }}>
                    Título da Capa:
                  </label>
                  <input
                    type="text"
                    value={thumbTitle}
                    onChange={(e) => setThumbTitle(e.target.value)}
                    style={{
                      background: "#171A25",
                      border: "1px solid #2B3042",
                      color: "#FFF",
                      padding: "0.45rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      width: "100%",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.76rem", color: "#94A3B8", display: "block", marginBottom: "0.25rem" }}>
                    Cor do Destaque:
                  </label>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      type="button"
                      onClick={() => setTitleColor("yellow")}
                      style={{
                        flex: 1,
                        padding: "0.35rem",
                        borderRadius: "5px",
                        border: titleColor === "yellow" ? "2px solid #FFF" : "1px solid transparent",
                        background: "#FFE600",
                        color: "#000",
                        fontWeight: 800,
                        fontSize: "0.72rem",
                        cursor: "pointer",
                      }}
                    >
                      Amarelo
                    </button>
                    <button
                      type="button"
                      onClick={() => setTitleColor("cyan")}
                      style={{
                        flex: 1,
                        padding: "0.35rem",
                        borderRadius: "5px",
                        border: titleColor === "cyan" ? "2px solid #FFF" : "1px solid transparent",
                        background: "#00F0FF",
                        color: "#000",
                        fontWeight: 800,
                        fontSize: "0.72rem",
                        cursor: "pointer",
                      }}
                    >
                      Ciano
                    </button>
                    <button
                      type="button"
                      onClick={() => setTitleColor("white")}
                      style={{
                        flex: 1,
                        padding: "0.35rem",
                        borderRadius: "5px",
                        border: titleColor === "white" ? "2px solid #6366F1" : "1px solid #4B5563",
                        background: "#FFF",
                        color: "#000",
                        fontWeight: 800,
                        fontSize: "0.72rem",
                        cursor: "pointer",
                      }}
                    >
                      Branco
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <button
                    type="button"
                    onClick={captureFrame}
                    style={{
                      background: "#1E2333",
                      border: "1px solid #31384E",
                      color: "#FFF",
                      padding: "0.45rem",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <Camera size={14} /> Capturar Frame Atual
                  </button>

                  <button
                    type="button"
                    onClick={downloadThumbnail}
                    disabled={!capturedThumbUrl}
                    style={{
                      background: capturedThumbUrl ? "#10B981" : "#1C202B",
                      border: "none",
                      color: capturedThumbUrl ? "#FFF" : "#64748B",
                      padding: "0.45rem",
                      borderRadius: "6px",
                      cursor: capturedThumbUrl ? "pointer" : "not-allowed",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <DownloadIcon size={14} /> Baixar Capa JPG
                  </button>
                </div>

                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            )}

            {/* ABA: FORMATOS */}
            {activeTab === "formats" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
                    Proporção &amp; Destinos
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
                    Formatos suportados para distribuição:
                  </p>
                </div>

                <div style={{ padding: "0.6rem", background: "#171A25", borderRadius: "6px", border: "1px solid #2B3042" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#00F0FF", fontWeight: 700, fontSize: "0.8rem" }}>
                    <Smartphone size={14} /> 9:16 Vertical (Padrão)
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>TikTok, Reels, Shorts</span>
                </div>

                <div style={{ padding: "0.6rem", background: "#171A25", borderRadius: "6px", border: "1px solid #2B3042" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#FFF", fontWeight: 700, fontSize: "0.8rem" }}>
                    <Square size={14} /> 1:1 Quadrado
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>Feed Instagram, LinkedIn</span>
                </div>

                <div style={{ padding: "0.6rem", background: "#171A25", borderRadius: "6px", border: "1px solid #2B3042" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#FFF", fontWeight: 700, fontSize: "0.8rem" }}>
                    <Monitor size={14} /> 16:9 Widescreen
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>YouTube Tradicional</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* COLUNA CENTRAL: PLAYER VIEWPORT COM SAFE ZONES DO TIKTOK */}
        <main
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backgroundColor: "#090B10",
            overflow: "hidden",
          }}
        >
          {/* Container do Player 9:16 com Safe Zones */}
          <div
            style={{
              position: "relative",
              aspectRatio: "9/16",
              height: "calc(100% - 44px)",
              maxHeight: "480px",
              backgroundColor: "#000",
              borderRadius: "14px",
              overflow: "hidden",
              border: "1px solid #202534",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)",
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
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onClick={togglePlay}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    cursor: "pointer",
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

                {/* OVERLAY DE SAFE ZONES (TIKTOK / REELS / SHORTS) */}
                {showSafeZones && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: "12px",
                      zIndex: 20,
                    }}
                  >
                    {/* Top Bar Safe Margin */}
                    <div
                      style={{
                        height: "44px",
                        borderBottom: "1px dashed rgba(255, 255, 255, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255, 255, 255, 0.4)",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                      }}
                    >
                      <span>TOPO (Seguindo / Para Você)</span>
                    </div>

                    {/* Lateral Direita (Botões de Curtir / Comentar / Compartilhar) */}
                    <div
                      style={{
                        position: "absolute",
                        right: "8px",
                        bottom: "90px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        alignItems: "center",
                        opacity: 0.35,
                      }}
                    >
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px dashed #FFF" }} />
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px dashed #FFF" }} />
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px dashed #FFF" }} />
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1px dashed #00F0FF" }} />
                    </div>

                    {/* Bottom Safe Margin (Nome do Usuário e Legenda do TikTok) */}
                    <div
                      style={{
                        height: "76px",
                        borderTop: "1px dashed rgba(255, 255, 255, 0.25)",
                        paddingTop: "6px",
                        color: "rgba(255, 255, 255, 0.4)",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                      }}
                    >
                      <span>BASE (Nome do Perfil &amp; Legenda)</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: "#64748B", fontSize: "0.85rem" }}>Vídeo não carregado</div>
            )}
          </div>

          {/* Barra de Controles Inferior do Player */}
          <div
            style={{
              height: "40px",
              marginTop: "0.4rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={() => seekRelative(-1)}
              style={{
                background: "#151822",
                border: "1px solid #262B3A",
                color: "#FFF",
                padding: "0.3rem 0.55rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.72rem",
                fontWeight: 600,
              }}
              title="Voltar 1 segundo"
            >
              -1s
            </button>

            <button
              type="button"
              onClick={togglePlay}
              style={{
                background: isPlaying ? "#EF4444" : "#6366F1",
                border: "none",
                color: "#FFF",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
              title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
            >
              <Play size={16} style={{ marginLeft: isPlaying ? "0" : "2px" }} />
            </button>

            <button
              type="button"
              onClick={() => seekRelative(1)}
              style={{
                background: "#151822",
                border: "1px solid #262B3A",
                color: "#FFF",
                padding: "0.3rem 0.55rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.72rem",
                fontWeight: 600,
              }}
              title="Avançar 1 segundo"
            >
              +1s
            </button>

            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
              (Espaço para Play/Pause • Setas para navegar)
            </span>
          </div>
        </main>

        {/* COLUNA DIREITA: INSPETOR DE PROPRIEDADES CONTEXTUAL */}
        <aside
          style={{
            backgroundColor: "#13161F",
            borderLeft: "1px solid #212634",
            padding: "0.85rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", borderBottom: "1px solid #212634", paddingBottom: "0.4rem" }}>
            <SlidersHorizontal size={14} style={{ color: "#00F0FF" }} />
            <h4 style={{ margin: 0, fontSize: "0.86rem", color: "#FFF" }}>Inspetor de Propriedades</h4>
          </div>

          {selectedBroll ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.74rem", color: "#00F0FF", fontWeight: 700 }}>
                  Item Selecionado:
                </span>
                <button
                  type="button"
                  onClick={() => removeBroll(selectedBroll.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#EF4444",
                    cursor: "pointer",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                  }}
                >
                  Excluir
                </button>
              </div>

              <div>
                <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                  Template:
                </label>
                <select
                  value={selectedBroll.template}
                  onChange={(e) => updateBroll(selectedBroll.id, { template: e.target.value as CanvasBrollTemplate })}
                  style={{
                    width: "100%",
                    background: "#181B26",
                    border: "1px solid #2A3042",
                    color: "#FFF",
                    padding: "0.35rem",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                  }}
                >
                  <option value="metric_counter">Contador de Métrica</option>
                  <option value="growth_chart">Gráfico de Crescimento</option>
                  <option value="glass_alert">Alerta Glassmorphism</option>
                  <option value="viral_tag">Tag Viral</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                  Título / Tag:
                </label>
                <input
                  type="text"
                  value={selectedBroll.data.title || ""}
                  onChange={(e) => updateBroll(selectedBroll.id, { data: { ...selectedBroll.data, title: e.target.value } })}
                  style={{
                    width: "100%",
                    background: "#181B26",
                    border: "1px solid #2A3042",
                    color: "#FFF",
                    padding: "0.35rem",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                  Valor em Destaque:
                </label>
                <input
                  type="text"
                  value={selectedBroll.data.value || ""}
                  onChange={(e) => updateBroll(selectedBroll.id, { data: { ...selectedBroll.data, value: e.target.value } })}
                  style={{
                    width: "100%",
                    background: "#181B26",
                    border: "1px solid #2A3042",
                    color: "#00F0FF",
                    fontWeight: 700,
                    padding: "0.35rem",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                  Posição Vertical:
                </label>
                <select
                  value={selectedBroll.data.positionY || "top"}
                  onChange={(e) => updateBroll(selectedBroll.id, { data: { ...selectedBroll.data, positionY: e.target.value as any } })}
                  style={{
                    width: "100%",
                    background: "#181B26",
                    border: "1px solid #2A3042",
                    color: "#FFF",
                    padding: "0.35rem",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                  }}
                >
                  <option value="top">Topo</option>
                  <option value="center">Centro</option>
                  <option value="bottom">Base</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                <div>
                  <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                    Início (s):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedBroll.offsetSec}
                    onChange={(e) => updateBroll(selectedBroll.id, { offsetSec: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: "100%",
                      background: "#181B26",
                      border: "1px solid #2A3042",
                      color: "#FFF",
                      padding: "0.35rem",
                      borderRadius: "6px",
                      fontSize: "0.76rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                    Duração (s):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedBroll.durationSec}
                    onChange={(e) => updateBroll(selectedBroll.id, { durationSec: parseFloat(e.target.value) || 1 })}
                    style={{
                      width: "100%",
                      background: "#181B26",
                      border: "1px solid #2A3042",
                      color: "#FFF",
                      padding: "0.35rem",
                      borderRadius: "6px",
                      fontSize: "0.76rem",
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "1rem 0.5rem",
                textAlign: "center",
                color: "#64748B",
                fontSize: "0.76rem",
              }}
            >
              Clique em um elemento na timeline para editar suas propriedades.
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: "0.75rem", borderTop: "1px solid #212634" }}>
            <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block" }}>
              Gancho Editorial:
            </span>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.72rem", color: "#94A3B8", fontStyle: "italic" }}>
              &quot;{clip.hook || clip.title}&quot;
            </p>
          </div>
        </aside>
      </div>

      {/* 3. TIMELINE MULTITRACK PROFISSIONAL (ESTILO CAPCUT) */}
      <footer
        style={{
          height: "215px",
          backgroundColor: "#0F1118",
          borderTop: "1px solid #212635",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Barra de Ferramentas da Timeline */}
        <div
          style={{
            height: "36px",
            backgroundColor: "#141722",
            borderBottom: "1px solid #212635",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={setStartToCurrent}
              style={{
                background: "transparent",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                fontSize: "0.74rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
              title="Marcar início do clipe no playhead"
            >
              <Scissors size={13} style={{ color: "#00F0FF" }} /> Split Início
            </button>

            <button
              type="button"
              onClick={setEndToCurrent}
              style={{
                background: "transparent",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                fontSize: "0.74rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
              title="Marcar fim do clipe no playhead"
            >
              <Scissors size={13} style={{ color: "#00F0FF" }} /> Split Fim
            </button>

            {selectedBrollId && (
              <button
                type="button"
                onClick={() => removeBroll(selectedBrollId)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#EF4444",
                  cursor: "pointer",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Trash2 size={13} /> Excluir B-Roll
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748B" }}>Zoom:</span>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {[1, 1.5, 2].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomScale(z)}
                  style={{
                    background: zoomScale === z ? "#6366F1" : "#1C202E",
                    color: zoomScale === z ? "#FFF" : "#94A3B8",
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.15rem 0.4rem",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {z}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Régua de Tempo (Time Ruler) */}
        <div
          style={{
            height: "22px",
            backgroundColor: "#0B0D13",
            borderBottom: "1px solid #1C202C",
            position: "relative",
            overflow: "hidden",
            marginLeft: "90px", // Espaço para rótulo das faixas
          }}
        >
          {rulerMarks.map((sec) => {
            const leftPct = (sec / duration) * 100;
            return (
              <div
                key={sec}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  top: 0,
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ width: "1px", height: "6px", backgroundColor: "#3B4254" }} />
                <span
                  style={{
                    fontSize: "0.62rem",
                    color: "#64748B",
                    fontFamily: "'JetBrains Mono', monospace",
                    transform: "translateX(-50%)",
                  }}
                >
                  {sec}s
                </span>
              </div>
            );
          })}
        </div>

        {/* Faixas Multitrack Empilhadas */}
        <div
          ref={timelineTracksRef}
          onClick={handleTimelineScrub}
          style={{
            flex: 1,
            position: "relative",
            overflowY: "auto",
            overflowX: "hidden",
            cursor: "pointer",
            backgroundColor: "#0D0F16",
          }}
        >
          {/* Agulha Vertical de Reprodução (Playhead Needle) */}
          <div
            style={{
              position: "absolute",
              left: `calc(90px + ${(currentTime / duration) * 100}% * ((100% - 90px) / 100%))`,
              top: 0,
              bottom: 0,
              width: "2px",
              backgroundColor: "#EF4444",
              boxShadow: "0 0 8px #EF4444",
              zIndex: 30,
              pointerEvents: "none",
            }}
          >
            {/* Cabeça Triangular do Playhead */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "-5px",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "8px solid #EF4444",
              }}
            />
          </div>

          {/* FAIXA 1: LEGENDAS & TEXTO (AMARELO) */}
          <div
            style={{
              height: "36px",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid #181C26",
            }}
          >
            <div
              style={{
                width: "90px",
                paddingLeft: "0.75rem",
                fontSize: "0.7rem",
                color: "#FACC15",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              🔤 Legendas
            </div>
            <div style={{ flex: 1, position: "relative", height: "24px" }}>
              <div
                style={{
                  position: "absolute",
                  left: "2%",
                  width: "96%",
                  height: "100%",
                  background: "rgba(250, 204, 21, 0.15)",
                  border: "1px solid rgba(250, 204, 21, 0.4)",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "0.5rem",
                  fontSize: "0.68rem",
                  color: "#FDE047",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {clip.hook || clip.title}
              </div>
            </div>
          </div>

          {/* FAIXA 2: B-ROLLS & OVERLAYS (CIANO / ROXO) */}
          <div
            style={{
              height: "36px",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid #181C26",
            }}
          >
            <div
              style={{
                width: "90px",
                paddingLeft: "0.75rem",
                fontSize: "0.7rem",
                color: "#00F0FF",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              ⚡ B-Rolls
            </div>
            <div style={{ flex: 1, position: "relative", height: "24px" }}>
              {canvasBrolls.map((b) => {
                const leftPct = (b.offsetSec / duration) * 100;
                const widthPct = Math.max(2, (b.durationSec / duration) * 100);
                const isSelected = b.id === selectedBrollId;
                return (
                  <div
                    key={b.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBrollId(b.id);
                      jumpToTime(b.offsetSec);
                    }}
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: "100%",
                      backgroundColor: isSelected ? "#00F0FF" : "rgba(0, 240, 255, 0.35)",
                      color: isSelected ? "#000" : "#FFF",
                      border: `1px solid ${isSelected ? "#FFF" : "#00F0FF"}`,
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      padding: "0 0.3rem",
                      boxShadow: isSelected ? "0 0 10px rgba(0, 240, 255, 0.6)" : "none",
                    }}
                    title={`${b.data.title || "B-Roll"} (${b.durationSec}s)`}
                  >
                    {b.data.title || "B-Roll"}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FAIXA 3: VÍDEO PRINCIPAL COM TRIM (ÍNDIGO / AZUL) */}
          <div
            style={{
              height: "36px",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid #181C26",
            }}
          >
            <div
              style={{
                width: "90px",
                paddingLeft: "0.75rem",
                fontSize: "0.7rem",
                color: "#818CF8",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              🎞 Vídeo
            </div>
            <div style={{ flex: 1, position: "relative", height: "24px" }}>
              {/* Trecho Recortado Ativo */}
              <div
                style={{
                  position: "absolute",
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / duration) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #4F46E5, #6366F1)",
                  border: "1px solid #818CF8",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 0.5rem",
                  fontSize: "0.68rem",
                  color: "#FFF",
                  fontWeight: 700,
                }}
              >
                <span>Início: {trimStart.toFixed(1)}s</span>
                <span>Fim: {trimEnd.toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* FAIXA 4: ÁUDIO & SOUND DESIGN (VERDE ESMERALDA) */}
          <div
            style={{
              height: "36px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "90px",
                paddingLeft: "0.75rem",
                fontSize: "0.7rem",
                color: "#10B981",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              🎵 Áudio / SFX
            </div>
            <div style={{ flex: 1, position: "relative", height: "24px" }}>
              {/* Indicador de SFX Ding no Gancho */}
              <div
                style={{
                  position: "absolute",
                  left: "0.5%",
                  width: "12%",
                  height: "100%",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid #10B981",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  color: "#6EE7B7",
                  fontWeight: 700,
                }}
              >
                🔔 Hook Ding
              </div>

              {/* Indicador de Transição Whoosh nos B-Rolls */}
              {canvasBrolls.map((b) => (
                <div
                  key={"sfx-" + b.id}
                  style={{
                    position: "absolute",
                    left: `${(b.offsetSec / duration) * 100}%`,
                    width: "8%",
                    height: "100%",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px dashed #10B981",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.62rem",
                    color: "#6EE7B7",
                  }}
                >
                  💨 Whoosh
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
