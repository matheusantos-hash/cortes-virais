"use client";

import React from "react";
import { SYSTEM_FONTS } from "@/lib/systemFonts";
import { Palette, Volume2 } from "../Icons";
import ModernColorPicker from "../ModernColorPicker";

interface AdvancedSubtitlesSectionProps {
  selectedFontName: string;
  onFontNameChange: (val: string) => void;
  subtitleStyle: "hormozi" | "apple" | "beast" | "minimal";
  onSubtitleStyleChange: (val: "hormozi" | "apple" | "beast" | "minimal") => void;
  primaryColor: string;
  onPrimaryColorChange: (val: string) => void;
  highlightColor: string;
  onHighlightColorChange: (val: string) => void;
  enableEmojis: boolean;
  onEnableEmojisChange: (val: boolean) => void;
  enableSfx: boolean;
  onEnableSfxChange: (val: boolean) => void;
}

export default function AdvancedSubtitlesSection({
  selectedFontName,
  onFontNameChange,
  subtitleStyle,
  onSubtitleStyleChange,
  primaryColor,
  onPrimaryColorChange,
  highlightColor,
  onHighlightColorChange,
  enableEmojis,
  onEnableEmojisChange,
  enableSfx,
  onEnableSfxChange,
}: AdvancedSubtitlesSectionProps) {
  return (
    <div
      className="card stack"
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--card-border)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <strong
          style={{
            fontSize: "0.95rem",
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            color: "var(--primary)",
          }}
        >
          <Palette size={16} /> Estilo de Legenda &amp; Sound Design
        </strong>
        <span
          className="badge"
          style={{ background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", fontSize: "0.72rem" }}
        >
          Alta Retenção
        </span>
      </div>

      <div className="grid2" style={{ marginTop: "0.5rem" }}>
        <label>
          Tipografia das Legendas (Fontes do Sistema):
          <select
            value={selectedFontName}
            onChange={(e) => onFontNameChange(e.target.value)}
            style={{ marginTop: "0.3rem" }}
          >
            {SYSTEM_FONTS.map((font) => (
              <option key={font.id} value={font.name}>
                {font.name} {font.id === "poppins" ? "⭐ (Recomendada / Poppins)" : `— ${font.category}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Estilo de Animação / Preset:
          <select
            value={subtitleStyle}
            onChange={(e) => onSubtitleStyleChange(e.target.value as any)}
            style={{ marginTop: "0.3rem" }}
          >
            <option value="hormozi">Alex Hormozi (Amarelo vibrante, contorno preto espesso)</option>
            <option value="beast">MrBeast Impact (Cores neon dinâmicas e ritmo ultra-rápido)</option>
            <option value="apple">Apple Minimal (Tipografia limpa, cantos suaves, estilo Apple)</option>
            <option value="minimal">Legenda Clássica (Subtítulo discreto na base com fundo suave)</option>
          </select>
        </label>
      </div>

      {/* Paleta rápida de cores das legendas com Swatches SVG redondos e Pizza de Cores */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
          background: "rgba(0,0,0,0.22)",
          padding: "0.75rem 0.9rem",
          borderRadius: "10px",
          border: "1px solid var(--card-border)",
        }}
      >
        <ModernColorPicker
          label="Cor do Texto:"
          color={primaryColor}
          onChange={onPrimaryColorChange}
          presetColors={[
            { color: "#FFFFFF", name: "Branco" },
            { color: "#FACC15", name: "Amarelo" },
            { color: "#00F0FF", name: "Ciano" },
            { color: "#10B981", name: "Verde" },
          ]}
          compact
        />

        <ModernColorPicker
          label="Destaque (Karaoke):"
          color={highlightColor}
          onChange={onHighlightColorChange}
          presetColors={[
            { color: "#FACC15", name: "Amarelo Vibrante" },
            { color: "#10B981", name: "Verde Neon" },
            { color: "#00F0FF", name: "Ciano Elétrico" },
            { color: "#FF007A", name: "Magenta" },
            { color: "#FB923C", name: "Laranja" },
          ]}
          compact
        />
      </div>

      <div className="stack" style={{ gap: "0.5rem", marginTop: "0.25rem" }}>
        <label
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
            margin: 0,
          }}
        >
          <input
            type="checkbox"
            checked={enableEmojis}
            onChange={(e) => onEnableEmojisChange(e.target.checked)}
            style={{ width: "1.1rem", height: "1.1rem", accentColor: "var(--primary)", cursor: "pointer" }}
          />
          <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>
            Injetar Emojis Automáticos contextuais na fala (🔥, 💰, 🚀)
          </span>
        </label>

        <label
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
            margin: 0,
          }}
        >
          <input
            type="checkbox"
            checked={enableSfx}
            onChange={(e) => onEnableSfxChange(e.target.checked)}
            style={{ width: "1.1rem", height: "1.1rem", accentColor: "var(--primary)", cursor: "pointer" }}
          />
          <span
            style={{
              fontSize: "0.85rem",
              color: "var(--text)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <Volume2 size={14} style={{ color: "var(--primary)" }} /> Sound Design (Whoosh, Pop e Ding sincronizados)
          </span>
        </label>
      </div>
    </div>
  );
}
