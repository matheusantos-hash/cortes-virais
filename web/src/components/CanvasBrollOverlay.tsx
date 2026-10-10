"use client";

import { useEffect, useRef } from "react";
import type { CanvasBroll } from "@/lib/types";

interface CanvasBrollOverlayProps {
  brolls: CanvasBroll[];
  currentTime: number;
  isPlaying: boolean;
  style?: React.CSSProperties;
}

export default function CanvasBrollOverlay({
  brolls,
  currentTime,
  isPlaying,
  style,
}: CanvasBrollOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resolução base canônica de estúdio: 1080 x 1920
    const W = 1080;
    const H = 1920;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      // Localiza o B-Roll ativo no segundo atual
      const active = brolls.find(
        (b) => currentTime >= b.offsetSec && currentTime <= b.offsetSec + b.durationSec
      );

      if (active) {
        const localT = currentTime - active.offsetSec;
        const progress = Math.min(1, Math.max(0, localT / active.durationSec));
        drawTemplate(ctx, active, progress, W, H);
      }

      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [brolls, currentTime, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        objectFit: "contain",
        zIndex: 20,
        ...style,
      }}
    />
  );
}

/** Desenha o template gráfico de alta retenção no Canvas */
function drawTemplate(
  ctx: CanvasRenderingContext2D,
  broll: CanvasBroll,
  progress: number,
  W: number,
  H: number
) {
  ctx.save();

  // Easing suave (entrada rápida e saída suave)
  const easeProgress = 1 - Math.pow(1 - progress, 3);

  // Fade in nos primeiros 15% e fade out nos últimos 15%
  let opacity = 1;
  if (progress < 0.15) opacity = progress / 0.15;
  else if (progress > 0.85) opacity = (1 - progress) / 0.15;
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

  // Posição Vertical (Safe Zone)
  let centerY = H * 0.35; // Padrão: terço superior para não colidir com legendas
  if (broll.data.positionY === "center") centerY = H * 0.48;
  if (broll.data.positionY === "bottom") centerY = H * 0.72;

  const colorKey = broll.data.color || "cyan";
  const colors = {
    cyan: { primary: "#00F0FF", glow: "rgba(0, 240, 255, 0.4)", bg: "rgba(6, 18, 36, 0.88)" },
    green: { primary: "#10B981", glow: "rgba(16, 185, 129, 0.4)", bg: "rgba(4, 28, 18, 0.88)" },
    yellow: { primary: "#FFE600", glow: "rgba(255, 230, 0, 0.4)", bg: "rgba(30, 24, 4, 0.88)" },
    purple: { primary: "#A855F7", glow: "rgba(168, 85, 247, 0.4)", bg: "rgba(24, 8, 38, 0.88)" },
  }[colorKey];

  switch (broll.template) {
    case "metric_counter":
      drawMetricCounter(ctx, broll, easeProgress, centerY, W, colors);
      break;
    case "growth_chart":
      drawGrowthChart(ctx, broll, easeProgress, centerY, W, colors);
      break;
    case "glass_alert":
      drawGlassAlert(ctx, broll, easeProgress, centerY, W, colors);
      break;
    case "viral_tag":
      drawViralTag(ctx, broll, easeProgress, centerY, W, colors);
      break;
  }

  ctx.restore();
}

/** Template 1: Contador Dinâmico de Métrica */
function drawMetricCounter(
  ctx: CanvasRenderingContext2D,
  broll: CanvasBroll,
  progress: number,
  centerY: number,
  W: number,
  colors: any
) {
  const boxW = 860;
  const boxH = 340;
  const x = (W - boxW) / 2;
  const y = centerY - boxH / 2;

  // Sombra e Glow Neon
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 35;

  // Caixa de Fundo com Borda
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 32);
  ctx.fill();

  ctx.lineWidth = 6;
  ctx.strokeStyle = colors.primary;
  ctx.stroke();

  // Reset de sombra para textos
  ctx.shadowBlur = 0;

  // Título / Label
  ctx.font = "800 36px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText((broll.data.title || "MÉTRICA CHAVE").toUpperCase(), W / 2, y + 80);

  // Valor com Interpolação Numérica
  const rawVal = broll.data.value || "300%";
  const numMatch = rawVal.match(/(\d+)/);
  let displayValue = rawVal;
  if (numMatch) {
    const targetNum = parseInt(numMatch[1], 10);
    const currNum = Math.round(targetNum * Math.min(1, progress * 1.25));
    displayValue = rawVal.replace(numMatch[1], String(currNum));
  }

  ctx.font = "900 110px Arial, sans-serif";
  ctx.fillStyle = colors.primary;
  ctx.fillText(displayValue, W / 2, y + 200);

  // Subtítulo
  if (broll.data.subtitle) {
    ctx.font = "600 30px Arial, sans-serif";
    ctx.fillStyle = "#CBD5E1";
    ctx.fillText(broll.data.subtitle, W / 2, y + 270);
  }
}

/** Template 2: Gráfico de Linha Ascendente */
function drawGrowthChart(
  ctx: CanvasRenderingContext2D,
  broll: CanvasBroll,
  progress: number,
  centerY: number,
  W: number,
  colors: any
) {
  const boxW = 880;
  const boxH = 420;
  const x = (W - boxW) / 2;
  const y = centerY - boxH / 2;

  // Fundo do Card
  ctx.fillStyle = "rgba(10, 15, 30, 0.92)";
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 36);
  ctx.fill();

  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.stroke();

  // Título do Gráfico
  ctx.font = "800 38px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(broll.data.title || "CRESCIMENTO EXPONENCIAL", x + 60, y + 80);

  // Área do Gráfico de Linha
  const chartX = x + 60;
  const chartY = y + 140;
  const chartW = boxW - 120;
  const chartH = 200;

  // Pontos da Curva Ascendente
  const pts = [
    { x: 0, y: chartH * 0.85 },
    { x: 0.25, y: chartH * 0.7 },
    { x: 0.5, y: chartH * 0.55 },
    { x: 0.75, y: chartH * 0.35 },
    { x: 1.0, y: chartH * 0.1 },
  ];

  const currentPtsCount = Math.max(2, Math.ceil(pts.length * progress));
  const activePts = pts.slice(0, currentPtsCount);

  // Desenha a Linha Neon
  ctx.beginPath();
  activePts.forEach((p, idx) => {
    const px = chartX + p.x * chartW;
    const py = chartY + p.y;
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });

  ctx.lineWidth = 10;
  ctx.strokeStyle = colors.primary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 25;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Ponto brilhante final
  const lastPt = activePts[activePts.length - 1];
  const lastPx = chartX + lastPt.x * chartW;
  const lastPy = chartY + lastPt.y;

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(lastPx, lastPy, 14, 0, Math.PI * 2);
  ctx.fill();

  // Badge no Topo
  ctx.fillStyle = colors.primary;
  ctx.font = "900 42px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(broll.data.value || "+450%", x + boxW - 60, y + 80);
}

/** Template 3: Card de Notificação Glassmorphism */
function drawGlassAlert(
  ctx: CanvasRenderingContext2D,
  broll: CanvasBroll,
  progress: number,
  centerY: number,
  W: number,
  colors: any
) {
  const boxW = 860;
  const boxH = 240;
  const x = (W - boxW) / 2;
  const y = centerY - boxH / 2;

  // Card com efeito de Vidro
  ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 32);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = colors.primary;
  ctx.stroke();

  // Ícone / Badge Circular
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.arc(x + 90, centerY, 48, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "900 48px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";
  ctx.fillText("⚡", x + 90, centerY);

  // Textos
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = "800 40px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(broll.data.title || "ATENÇÃO A ESTE PONTO", x + 170, y + 95);

  ctx.font = "600 32px Arial, sans-serif";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText(broll.data.subtitle || broll.data.value || "Momento de virada essencial", x + 170, y + 165);
}

/** Template 4: Tag Viral Chanfrada */
function drawViralTag(
  ctx: CanvasRenderingContext2D,
  broll: CanvasBroll,
  progress: number,
  centerY: number,
  W: number,
  colors: any
) {
  const text = (broll.data.value || broll.data.title || "VIRAL FACT").toUpperCase();
  ctx.font = "900 68px Arial, sans-serif";
  const metrics = ctx.measureText(text);
  const boxW = Math.max(500, metrics.width + 120);
  const boxH = 150;
  const x = (W - boxW) / 2;
  const y = centerY - boxH / 2;

  // Fundo Amarelo Vibrante
  ctx.fillStyle = colors.primary;
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 20);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Texto Preto Pesado
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, centerY);
}

/** Componente de prévia isolada e animada de um elemento B-Roll */
export function BrollPreviewCanvas({
  broll,
  className,
  style,
}: {
  broll: CanvasBroll;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;

    let animFrame: number;
    const start = performance.now();
    const durationMs = Math.max(1.5, broll.durationSec || 3.0) * 1000;

    const render = (now: number) => {
      const elapsed = (now - start) % durationMs;
      const progress = elapsed / durationMs;
      ctx.clearRect(0, 0, W, H);
      drawTemplate(ctx, broll, progress, W, H);
      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrame);
  }, [broll]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "contain",
        ...style,
      }}
    />
  );
}
