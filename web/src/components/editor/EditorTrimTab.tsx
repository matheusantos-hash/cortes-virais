"use client";

import React from "react";
import { Play } from "../Icons";

interface EditorTrimTabProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onTrimStartChange: (val: number) => void;
  onTrimEndChange: (val: number) => void;
  onSetStartToCurrent: () => void;
  onSetEndToCurrent: () => void;
  onPlaySelectedRange: () => void;
}

export default function EditorTrimTab({
  duration,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
  onSetStartToCurrent,
  onSetEndToCurrent,
  onPlaySelectedRange,
}: EditorTrimTabProps) {
  return (
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
          <span style={{ fontSize: "0.78rem" }}>
            Início: <strong style={{ color: "#00F0FF" }}>{trimStart.toFixed(1)}s</strong>
          </span>
          <button
            type="button"
            onClick={onSetStartToCurrent}
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
          onChange={(e) => onTrimStartChange(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "#6366F1" }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.8rem", marginBottom: "0.3rem" }}>
          <span style={{ fontSize: "0.78rem" }}>
            Fim: <strong style={{ color: "#00F0FF" }}>{trimEnd.toFixed(1)}s</strong>
          </span>
          <button
            type="button"
            onClick={onSetEndToCurrent}
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
          onChange={(e) => onTrimEndChange(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "#6366F1" }}
        />

        <div style={{ marginTop: "0.75rem", textAlign: "center", fontSize: "0.76rem", color: "#A855F7", fontWeight: 700 }}>
          Nova Duração: {(trimEnd - trimStart).toFixed(1)} segundos
        </div>
      </div>

      <button
        type="button"
        onClick={onPlaySelectedRange}
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
  );
}
