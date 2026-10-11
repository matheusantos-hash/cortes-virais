"use client";

import React from "react";
import { Smartphone, Square, Monitor } from "../Icons";
import type { VerticalMode } from "@/lib/types";

interface EditorFormatsTabProps {
  aspectRatio: "9:16" | "1:1" | "16:9";
  onAspectRatioChange: (val: "9:16" | "1:1" | "16:9") => void;
  verticalMode: VerticalMode;
  onVerticalModeChange: (val: VerticalMode) => void;
}

export default function EditorFormatsTab({
  aspectRatio,
  onAspectRatioChange,
  verticalMode,
  onVerticalModeChange,
}: EditorFormatsTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div>
        <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
          Proporção &amp; Destinos
        </h4>
        <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
          Escolha a proporção ideal para distribuição nas redes:
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div
          onClick={() => onAspectRatioChange("9:16")}
          style={{
            padding: "0.65rem",
            background: aspectRatio === "9:16" ? "rgba(0, 240, 255, 0.12)" : "#171A25",
            borderRadius: "8px",
            border: `1px solid ${aspectRatio === "9:16" ? "#00F0FF" : "#2B3042"}`,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                color: aspectRatio === "9:16" ? "#00F0FF" : "#FFF",
                fontWeight: 700,
                fontSize: "0.82rem",
              }}
            >
              <Smartphone size={15} /> 9:16 Vertical
            </div>
            {aspectRatio === "9:16" && (
              <span
                style={{
                  fontSize: "0.68rem",
                  background: "#00F0FF",
                  color: "#000",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "4px",
                  fontWeight: 800,
                }}
              >
                Ativo
              </span>
            )}
          </div>
          <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block", marginTop: "0.2rem" }}>
            TikTok, Instagram Reels, YouTube Shorts
          </span>
        </div>

        <div
          onClick={() => onAspectRatioChange("1:1")}
          style={{
            padding: "0.65rem",
            background: aspectRatio === "1:1" ? "rgba(0, 240, 255, 0.12)" : "#171A25",
            borderRadius: "8px",
            border: `1px solid ${aspectRatio === "1:1" ? "#00F0FF" : "#2B3042"}`,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                color: aspectRatio === "1:1" ? "#00F0FF" : "#FFF",
                fontWeight: 700,
                fontSize: "0.82rem",
              }}
            >
              <Square size={15} /> 1:1 Quadrado
            </div>
            {aspectRatio === "1:1" && (
              <span
                style={{
                  fontSize: "0.68rem",
                  background: "#00F0FF",
                  color: "#000",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "4px",
                  fontWeight: 800,
                }}
              >
                Ativo
              </span>
            )}
          </div>
          <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block", marginTop: "0.2rem" }}>
            Feed Instagram, LinkedIn, Carrosséis
          </span>
        </div>

        <div
          onClick={() => onAspectRatioChange("16:9")}
          style={{
            padding: "0.65rem",
            background: aspectRatio === "16:9" ? "rgba(0, 240, 255, 0.12)" : "#171A25",
            borderRadius: "8px",
            border: `1px solid ${aspectRatio === "16:9" ? "#00F0FF" : "#2B3042"}`,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                color: aspectRatio === "16:9" ? "#00F0FF" : "#FFF",
                fontWeight: 700,
                fontSize: "0.82rem",
              }}
            >
              <Monitor size={15} /> 16:9 Widescreen
            </div>
            {aspectRatio === "16:9" && (
              <span
                style={{
                  fontSize: "0.68rem",
                  background: "#00F0FF",
                  color: "#000",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "4px",
                  fontWeight: 800,
                }}
              >
                Ativo
              </span>
            )}
          </div>
          <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block", marginTop: "0.2rem" }}>
            YouTube Padrão, Desktop, TV
          </span>
        </div>
      </div>

      {aspectRatio === "9:16" && (
        <div style={{ background: "#151822", padding: "0.75rem", borderRadius: "8px", border: "1px solid #232838", marginTop: "0.4rem" }}>
          <span style={{ fontSize: "0.76rem", color: "#94A3B8", display: "block", marginBottom: "0.4rem", fontWeight: 600 }}>
            Modo de Preenchimento Vertical:
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
            <button
              type="button"
              onClick={() => onVerticalModeChange("grupo")}
              style={{
                padding: "0.45rem",
                borderRadius: "6px",
                border: verticalMode === "grupo" ? "1px solid #00F0FF" : "1px solid #2A3042",
                background: verticalMode === "grupo" ? "rgba(0,240,255,0.15)" : "#1A1D27",
                color: verticalMode === "grupo" ? "#00F0FF" : "#94A3B8",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Grupo Mesa (IA)
            </button>
            <button
              type="button"
              onClick={() => onVerticalModeChange("crop")}
              style={{
                padding: "0.45rem",
                borderRadius: "6px",
                border: verticalMode === "crop" ? "1px solid #00F0FF" : "1px solid #2A3042",
                background: verticalMode === "crop" ? "rgba(0,240,255,0.15)" : "#1A1D27",
                color: verticalMode === "crop" ? "#00F0FF" : "#94A3B8",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Recorte 9:16
            </button>
            <button
              type="button"
              onClick={() => onVerticalModeChange("blur")}
              style={{
                padding: "0.45rem",
                borderRadius: "6px",
                border: verticalMode === "blur" ? "1px solid #00F0FF" : "1px solid #2A3042",
                background: verticalMode === "blur" ? "rgba(0,240,255,0.15)" : "#1A1D27",
                color: verticalMode === "blur" ? "#00F0FF" : "#94A3B8",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Fundo Desfocado (Blur)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
