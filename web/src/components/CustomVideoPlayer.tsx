"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  MoreVertical,
  Download,
  Repeat,
  PictureInPicture2,
  Gauge,
  RotateCcw,
} from "lucide-react";
import { fmtClock } from "@/lib/format";

export interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  playsInline?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
  aspectRatio?: string;
  downloadFileName?: string;
  preload?: "auto" | "metadata" | "none";
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded?: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function CustomVideoPlayer({
  src,
  poster,
  autoPlay = false,
  playsInline = true,
  loop = false,
  muted: initialMuted = false,
  className = "",
  style = {},
  aspectRatio,
  downloadFileName = "clipe.mp4",
  preload,
  onLoadedMetadata,
  onEnded,
}: CustomVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(loop);

  // Estados de UI e interação
  const [showControls, setShowControls] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showSpeedSubmenu, setShowSpeedSubmenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [showCenterFeedback, setShowCenterFeedback] = useState<"play" | "pause" | null>(null);

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Iniciar timer para esconder controles
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (isPlaying && !showOptionsMenu && !isScrubbing) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying, showOptionsMenu, isScrubbing]);

  const handleMouseMove = () => {
    resetHideTimer();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    resetHideTimer();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (isPlaying && !showOptionsMenu && !isScrubbing) {
      setShowControls(false);
    }
  };

  // Alternar Play/Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch(() => {});
      setIsPlaying(true);
      setShowCenterFeedback("play");
    } else {
      video.pause();
      setIsPlaying(false);
      setShowCenterFeedback("pause");
    }

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setShowCenterFeedback(null);
    }, 600);
    resetHideTimer();
  }, [resetHideTimer]);

  // Atualizações de tempo do vídeo
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isScrubbing) return;
    setCurrentTime(video.currentTime);

    if (video.buffered.length > 0) {
      for (let i = video.buffered.length - 1; i >= 0; i--) {
        if (video.buffered.start(i) <= video.currentTime) {
          setBufferedEnd(video.buffered.end(i));
          break;
        }
      }
    }
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration || 0);
      video.playbackRate = playbackRate;
      video.loop = isLooping;
    }
    if (onLoadedMetadata) {
      onLoadedMetadata(e);
    }
  };

  // Mudo / Volume
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      video.volume = 0.5;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    const video = videoRef.current;
    setVolume(newVol);
    if (video) {
      video.volume = newVol;
      video.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  // Tela Cheia
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch {}
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  // Velocidade de reprodução
  const handleSetSpeed = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedSubmenu(false);
    setShowOptionsMenu(false);
  };

  // Alternar Loop
  const toggleLoop = () => {
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    if (videoRef.current) {
      videoRef.current.loop = nextLoop;
    }
    setShowOptionsMenu(false);
  };

  // Picture in Picture
  const handleTogglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {}
    setShowOptionsMenu(false);
  };

  // Download do clipe
  const handleDownload = () => {
    setShowOptionsMenu(false);
    const a = document.createElement("a");
    a.href = src;
    a.download = downloadFileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Interação com a Barra de Progresso (Scrubbing & Hover)
  const calculateProgressFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressContainerRef.current || duration <= 0) return 0;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return pos * duration;
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressContainerRef.current || duration <= 0) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(ratio * 100);
    setHoverTime(ratio * duration);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverTime(null);
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const targetTime = calculateProgressFromEvent(e);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!progressContainerRef.current || duration <= 0) return;
      const rect = progressContainerRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const newTime = ratio * duration;
      setCurrentTime(newTime);
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Atalhos de teclado quando em foco
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "f") {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === "m") {
      e.preventDefault();
      toggleMute();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
      }
    }
  };

  // Fechar menu de opções ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false);
        setShowSpeedSubmenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative overflow-hidden select-none outline-none ${className}`}
      style={{
        background: "#000",
        aspectRatio: aspectRatio || undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: isFullscreen ? 0 : "var(--radius, 12px)",
        ...style,
      }}
    >
      {/* Elemento de vídeo nativo HTML5 (sem controls padrão do navegador) */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload={preload || (poster ? "none" : "metadata")}
        autoPlay={autoPlay}
        playsInline={playsInline}
        loop={isLooping}
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleVideoLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          cursor: "pointer",
          display: "block",
        }}
      />

      {/* Feedback animado de Play / Pause no centro */}
      {showCenterFeedback && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
          style={{ animation: "customPlayerPulse 0.5s ease-out forwards" }}
        >
          <div
            style={{
              width: "68px",
              height: "68px",
              borderRadius: "50%",
              background: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFF",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            {showCenterFeedback === "play" ? (
              <Play size={32} style={{ fill: "#FFF", marginLeft: "4px" }} />
            ) : (
              <Pause size={32} style={{ fill: "#FFF" }} />
            )}
          </div>
        </div>
      )}

      {/* Botão flutuante central de Play quando pausado e não reproduzindo */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Reproduzir vídeo"
          className="player-icon-btn absolute z-10 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            width: "60px",
            height: "60px",
            padding: 0,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--primary, #6366F1), #4338CA)",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2)",
            cursor: "pointer",
            border: "none",
            flexShrink: 0,
          }}
        >
          <Play size={26} fill="currentColor" color="#FFFFFF" strokeWidth={2} style={{ marginLeft: "3px", flexShrink: 0 }} />
        </button>
      )}

      {/* Barra de Controles Inferior Estilizada */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${
          showControls || !isPlaying || isHovered || showOptionsMenu || isScrubbing
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={{
          background: "linear-gradient(to top, rgba(13, 15, 18, 0.95) 0%, rgba(13, 15, 18, 0.6) 65%, transparent 100%)",
          padding: "24px 14px 12px 14px",
        }}
      >
        {/* Barra de Progresso / Linha do Tempo (Scrubber) */}
        <div
          ref={progressContainerRef}
          onMouseMove={handleProgressBarMouseMove}
          onMouseLeave={handleProgressBarMouseLeave}
          onMouseDown={handleProgressBarMouseDown}
          className="relative w-full cursor-pointer group/bar flex items-center"
          style={{ height: "16px", marginBottom: "8px" }}
        >
          {/* Tooltip com tempo ao passar o mouse */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 text-xs font-mono font-semibold px-2 py-0.5 rounded shadow pointer-events-none transition-transform"
              style={{
                left: `${hoverPosition}%`,
                transform: "translateX(-50%)",
                background: "rgba(15, 23, 42, 0.92)",
                color: "#F8FAFC",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                whiteSpace: "nowrap",
                fontSize: "0.72rem",
              }}
            >
              {fmtClock(hoverTime)}
            </div>
          )}

          {/* Trilho base */}
          <div
            className="w-full relative overflow-hidden transition-all duration-150 group-hover/bar:h-2"
            style={{
              height: "4px",
              background: "rgba(255, 255, 255, 0.22)",
              borderRadius: "999px",
            }}
          >
            {/* Barra de buffer carregado */}
            <div
              className="absolute top-0 bottom-0 left-0"
              style={{
                width: `${bufferPercent}%`,
                background: "rgba(255, 255, 255, 0.35)",
                borderRadius: "999px",
              }}
            />

            {/* Barra de progresso atual com cor de destaque do projeto */}
            <div
              className="absolute top-0 bottom-0 left-0"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, var(--primary, #6366F1), #818CF8)",
                borderRadius: "999px",
              }}
            />
          </div>

          {/* Marcador deslizante (Thumb) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-transform duration-100 group-hover/bar:scale-125"
            style={{
              left: `${progressPercent}%`,
              width: "12px",
              height: "12px",
              background: "#FFFFFF",
              boxShadow: "0 0 8px var(--primary, #6366F1)",
              border: "2px solid var(--primary, #6366F1)",
            }}
          />
        </div>

        {/* Linha de botões de controle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          {/* Lado Esquerdo: Play/Pause, Volume, Tempo */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Botão Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              className="player-icon-btn hover:scale-105 active:scale-95 transition-transform"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "none",
                padding: 0,
                color: "#FFFFFF",
                width: "34px",
                height: "34px",
                minWidth: "34px",
                minHeight: "34px",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backdropFilter: "blur(4px)",
                flexShrink: 0,
              }}
            >
              {isPlaying ? (
                <Pause size={18} fill="currentColor" color="#FFFFFF" strokeWidth={2} style={{ flexShrink: 0 }} />
              ) : (
                <Play size={18} fill="currentColor" color="#FFFFFF" strokeWidth={2} style={{ marginLeft: "2px", flexShrink: 0 }} />
              )}
            </button>

            {/* Controle de Volume & Slider */}
            <div className="group/vol flex items-center" style={{ gap: "6px" }}>
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? "Ativar som" : "Desativar som"}
                className="player-icon-btn hover:text-indigo-400 transition-colors"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  width: "28px",
                  height: "28px",
                  color: isMuted ? "var(--text-muted, #94A3B8)" : "#FFFFFF",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} style={{ flexShrink: 0 }} /> : <Volume2 size={18} style={{ flexShrink: 0 }} />}
              </button>

              <div className="w-0 overflow-hidden group-hover/vol:w-16 transition-all duration-200 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Ajustar volume"
                  style={{
                    width: "60px",
                    height: "4px",
                    accentColor: "var(--primary, #6366F1)",
                    cursor: "pointer",
                  }}
                />
              </div>
            </div>

            {/* Temporizador */}
            <div
              style={{
                fontSize: "0.78rem",
                color: "#E2E8F0",
                fontFamily: "monospace",
                fontWeight: 600,
                letterSpacing: "0.5px",
              }}
            >
              <span>{fmtClock(currentTime)}</span>
              <span style={{ margin: "0 4px", opacity: 0.6 }}>/</span>
              <span style={{ opacity: 0.8 }}>{fmtClock(duration)}</span>
            </div>
          </div>

          {/* Lado Direito: Opções, Velocidade atual, Tela Cheia */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
            {/* Indicador de velocidade se diferente de 1x */}
            {playbackRate !== 1 && (
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  background: "rgba(99, 102, 241, 0.2)",
                  color: "#A5B4FC",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                {playbackRate}x
              </span>
            )}

            {/* Indicador de loop ativo */}
            {isLooping && (
              <span
                title="Modo repetição ativado"
                style={{
                  fontSize: "0.7rem",
                  color: "#34D399",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Repeat size={14} />
              </span>
            )}

            {/* Botão de Opções (Três pontos / Menu) */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setShowOptionsMenu(!showOptionsMenu);
                  setShowSpeedSubmenu(false);
                }}
                aria-label="Mais opções"
                title="Opções do player"
                className="player-icon-btn hover:scale-105 active:scale-95 transition-transform"
                style={{
                  background: showOptionsMenu ? "rgba(99, 102, 241, 0.3)" : "rgba(255, 255, 255, 0.12)",
                  border: showOptionsMenu ? "1px solid var(--primary, #6366F1)" : "1px solid transparent",
                  padding: 0,
                  color: "#FFFFFF",
                  width: "32px",
                  height: "32px",
                  minWidth: "32px",
                  minHeight: "32px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  backdropFilter: "blur(4px)",
                  flexShrink: 0,
                }}
              >
                <MoreVertical size={16} style={{ flexShrink: 0 }} />
              </button>

              {/* Menu Dropdown de Opções estilizado para o projeto */}
              {showOptionsMenu && (
                <div
                  className="absolute right-0 bottom-full mb-2 z-50 rounded-xl shadow-2xl p-1.5"
                  style={{
                    minWidth: "200px",
                    background: "rgba(24, 27, 34, 0.95)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid var(--card-border, #262A35)",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.6)",
                    color: "var(--text, #F3F4F6)",
                  }}
                >
                  {/* Seção Velocidade */}
                  <div style={{ padding: "4px 8px 6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "var(--text-muted, #94A3B8)",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        marginBottom: "6px",
                      }}
                    >
                      <Gauge size={13} />
                      Velocidade
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
                      {SPEED_OPTIONS.map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => handleSetSpeed(speed)}
                          style={{
                            padding: "4px 0",
                            fontSize: "0.75rem",
                            fontWeight: playbackRate === speed ? 800 : 500,
                            borderRadius: "6px",
                            border: "none",
                            background:
                              playbackRate === speed
                                ? "var(--primary, #6366F1)"
                                : "rgba(255, 255, 255, 0.06)",
                            color: playbackRate === speed ? "#FFFFFF" : "var(--text, #F3F4F6)",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ações: Repetição, PiP, Download */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                    {/* Repetir */}
                    <button
                      type="button"
                      onClick={toggleLoop}
                      className="flex items-center justify-between w-full px-3 py-2 text-left rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors"
                      style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                    >
                      <span className="flex items-center gap-2">
                        <Repeat size={14} style={{ color: isLooping ? "#34D399" : "inherit" }} />
                        Repetir corte
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: isLooping ? "rgba(52, 211, 153, 0.2)" : "rgba(255, 255, 255, 0.08)",
                          color: isLooping ? "#34D399" : "var(--text-muted, #94A3B8)",
                        }}
                      >
                        {isLooping ? "Ligado" : "Desligado"}
                      </span>
                    </button>

                    {/* Picture in Picture */}
                    {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
                      <button
                        type="button"
                        onClick={handleTogglePiP}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors"
                        style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                      >
                        <PictureInPicture2 size={14} />
                        Picture-in-Picture
                      </button>
                    )}

                    {/* Baixar Vídeo MP4 */}
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors"
                      style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                    >
                      <Download size={14} style={{ color: "var(--primary, #6366F1)" }} />
                      Baixar vídeo (MP4)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Botão Tela Cheia */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
              className="player-icon-btn hover:scale-105 active:scale-95 transition-transform"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "none",
                padding: 0,
                color: "#FFFFFF",
                width: "32px",
                height: "32px",
                minWidth: "32px",
                minHeight: "32px",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backdropFilter: "blur(4px)",
                flexShrink: 0,
              }}
            >
              {isFullscreen ? <Minimize2 size={16} style={{ flexShrink: 0 }} /> : <Maximize2 size={16} style={{ flexShrink: 0 }} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
