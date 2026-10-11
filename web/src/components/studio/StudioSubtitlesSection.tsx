"use client";

import React from "react";
import { Subtitles } from "../Icons";
import ModernColorPicker from "../ModernColorPicker";
import FontSelector from "../FontSelector";
import type { SubtitleStyle, SavedReference } from "@/lib/types";

interface StudioSubtitlesSectionProps {
  appliedRef: SavedReference | null;
  subtitleStyle: SubtitleStyle;
  onSubtitleStyleChange: (style: SubtitleStyle) => void;
  fontSize: "medium" | "large" | "extra";
  onFontSizeChange: (size: "medium" | "large" | "extra") => void;
  positionY: "bottom" | "center-bottom" | "center";
  onPositionYChange: (pos: "bottom" | "center-bottom" | "center") => void;
  primaryColor: string;
  onPrimaryColorChange: (color: string) => void;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  enableEmojis: boolean;
  onEnableEmojisChange: (val: boolean) => void;
  karaokeHighlight: boolean;
  onKaraokeHighlightChange: (val: boolean) => void;
  customFontName: string;
  onSelectFontName: (name: string) => void;
  customFontFile: File | null;
  customFontPath: string | null;
  fontPreviewUrl: string | null;
  onFontSelect: (file: File) => void;
  onClearCustomFont: () => void;
  baseColorPresets: { color: string; name: string }[];
  highlightColorPresets: { color: string; name: string }[];
}

export default function StudioSubtitlesSection({
  appliedRef,
  subtitleStyle,
  onSubtitleStyleChange,
  fontSize,
  onFontSizeChange,
  positionY,
  onPositionYChange,
  primaryColor,
  onPrimaryColorChange,
  highlightColor,
  onHighlightColorChange,
  enableEmojis,
  onEnableEmojisChange,
  karaokeHighlight,
  onKaraokeHighlightChange,
  customFontName,
  onSelectFontName,
  customFontFile,
  customFontPath,
  fontPreviewUrl,
  onFontSelect,
  onClearCustomFont,
  baseColorPresets,
  highlightColorPresets,
}: StudioSubtitlesSectionProps) {
  return (
    <div className="control-box">
      <div className="control-box-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Subtitles size={17} style={{ color: "var(--primary)" }} />
          <strong>Ajuste de Legendas</strong>
        </div>
        {appliedRef && (
          <span className="badge" style={{ fontSize: "0.68rem", background: "rgba(139, 92, 246, 0.15)", color: "var(--primary)" }}>
            {appliedRef.name.slice(0, 18)}…
          </span>
        )}
      </div>

      <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
        {/* Visualização Dinâmica da Legenda (Live Preview) */}
        <div
          style={{
            background: "rgba(10, 15, 29, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "8px",
            padding: "0.75rem",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span className="muted" style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Preview da Legenda em Tempo Real
            </span>
            <span style={{ fontSize: "0.68rem", color: "var(--primary)", fontWeight: 600 }}>
              {subtitleStyle.toUpperCase()} • {fontSize.toUpperCase()}
            </span>
          </div>

          <div
            style={{
              padding: "0.6rem 0.4rem",
              borderRadius: "6px",
              background: "radial-gradient(ellipse at center, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.95) 100%)",
              minHeight: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fontPreviewUrl ? "'PreviewCustomFont', sans-serif" : (customFontName ? `'${customFontName}', sans-serif` : "inherit"),
              fontSize: fontSize === "extra" ? "1.25rem" : fontSize === "large" ? "1.1rem" : "0.95rem",
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "0.5px",
            }}
          >
            <span
              style={{
                color: primaryColor,
                textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.8)",
                marginRight: "6px",
              }}
            >
              CORTE DA
            </span>
            <span
              style={{
                color: highlightColor,
                textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.8)",
              }}
            >
              PEGADA 🔥
            </span>
          </div>

          <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontSize: "0.7rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              Base: <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: primaryColor, display: "inline-block", border: "1px solid #666" }} /> <strong>{primaryColor}</strong>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              Destaque: <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: highlightColor, display: "inline-block", border: "1px solid #666" }} /> <strong>{highlightColor}</strong>
            </span>
            {customFontName && (
              <span style={{ color: "var(--primary)" }}>
                Fonte: <strong>{customFontName}</strong>
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="field-label">Estilo Visual</label>
          <select
            className="input select"
            value={subtitleStyle}
            onChange={(e) => onSubtitleStyleChange(e.target.value as SubtitleStyle)}
          >
            <option value="hormozi">Hormozi Pop (Impacto &amp; Contorno)</option>
            <option value="beast">Beast Neon (Verde/Amarelo)</option>
            <option value="apple">Apple Clean (Minimalista Elegante)</option>
            <option value="minimal">Discreto &amp; Neutro</option>
          </select>
        </div>

        <div className="row" style={{ gap: "0.5rem" }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Tamanho da Fonte</label>
            <select
              className="input select"
              value={fontSize}
              onChange={(e) => onFontSizeChange(e.target.value as any)}
            >
              <option value="medium">Médio (Discreto)</option>
              <option value="large">Grande (Social Padrão)</option>
              <option value="extra">Extra Grande (Retenção Alta)</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label className="field-label">Posição Vertical</label>
            <select
              className="input select"
              value={positionY}
              onChange={(e) => onPositionYChange(e.target.value as any)}
            >
              <option value="bottom">Inferior (Padrão)</option>
              <option value="center-bottom">Centro-Baixo (Otimizado)</option>
              <option value="center">Centro da Tela</option>
            </select>
          </div>
        </div>

        {/* COR 1: COR PRINCIPAL DO TEXTO (BASE DA LEGENDA) */}
        <ModernColorPicker
          label="Cor Principal do Texto (Base):"
          color={primaryColor}
          onChange={onPrimaryColorChange}
          presetColors={baseColorPresets}
        />

        {/* COR 2: COR DO DESTAQUE (KARAOKÊ / PALAVRA ATIVA) */}
        <ModernColorPicker
          label="Cor do Destaque (Karaokê):"
          color={highlightColor}
          onChange={onHighlightColorChange}
          presetColors={highlightColorPresets}
        />

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={enableEmojis}
            onChange={(e) => onEnableEmojisChange(e.target.checked)}
          />
          <span>Inserir emojis automáticos sincados no texto</span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={karaokeHighlight}
            onChange={(e) => onKaraokeHighlightChange(e.target.checked)}
          />
          <span>Destaque palavra por palavra (Word highlight)</span>
        </label>

        {/* Seletor de Fontes Embutidas + Ícone de Olho + Modal de Amostra com Negrito ON/OFF */}
        <div style={{ marginTop: "0.4rem", paddingTop: "0.6rem", borderTop: "1px dashed var(--card-border)" }}>
          <FontSelector
            selectedFontName={customFontName || "Montserrat Black"}
            onSelectFontName={onSelectFontName}
            onSelectCustomFile={onFontSelect}
            customFontFile={customFontFile}
            customFontPath={customFontPath}
            onClearCustomFont={onClearCustomFont}
            primaryColor={primaryColor}
            highlightColor={highlightColor}
            isInheritedFromStyle={Boolean(appliedRef && !customFontFile)}
            styleName={appliedRef?.name}
          />
        </div>
      </div>
    </div>
  );
}
