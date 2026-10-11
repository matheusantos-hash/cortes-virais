"use client";

import React from "react";
import { Type, Palette, Check, EyeIcon, EyeOffIcon } from "../Icons";
import ModernColorPicker from "../ModernColorPicker";
import { SYSTEM_FONTS } from "@/lib/systemFonts";
import type { SubtitleStyle } from "@/lib/types";

interface EditorSubtitlesTabProps {
  showSubtitlePreview: boolean;
  onToggleSubtitlePreview: () => void;
  selectedFontName: string;
  onSelectFontName: (fontName: string) => void;
  subtitleStyle: SubtitleStyle;
  onSelectSubtitleStyle: (style: SubtitleStyle) => void;
  primaryColor: string;
  onPrimaryColorChange: (color: string) => void;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  subtitlePosition: "bottom" | "center-bottom" | "center";
  onSubtitlePositionChange: (pos: "bottom" | "center-bottom" | "center") => void;
  subtitleFontSize: "small" | "medium" | "large" | "extra";
  customSubtitleFontSize: number;
  onFontSizeChange: (preset: "small" | "medium" | "large" | "extra", px: number) => void;
  onStepFontSize: (delta: number) => void;
  onCommitFontSizeHistory?: () => void;
  enableEmojis: boolean;
  onEnableEmojisChange: (val: boolean) => void;
}

export default function EditorSubtitlesTab({
  showSubtitlePreview,
  onToggleSubtitlePreview,
  selectedFontName,
  onSelectFontName,
  subtitleStyle,
  onSelectSubtitleStyle,
  primaryColor,
  onPrimaryColorChange,
  highlightColor,
  onHighlightColorChange,
  subtitlePosition,
  onSubtitlePositionChange,
  subtitleFontSize,
  customSubtitleFontSize,
  onFontSizeChange,
  onStepFontSize,
  onCommitFontSizeHistory,
  enableEmojis,
  onEnableEmojisChange,
}: EditorSubtitlesTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Cabeçalho da aba */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h4 style={{ margin: "0 0 0.15rem", fontSize: "0.9rem", color: "#FFF", display: "flex", alignItems: "center", gap: "6px" }}>
            <Type size={16} style={{ color: "#00F0FF" }} />
            Tipografia &amp; Legendas Virais
          </h4>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "#94A3B8" }}>
            Personalize fontes do sistema, cores de destaque e animações:
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleSubtitlePreview}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: showSubtitlePreview ? "rgba(0, 240, 255, 0.15)" : "#1E2230",
            border: `1px solid ${showSubtitlePreview ? "#00F0FF" : "#333A4D"}`,
            color: showSubtitlePreview ? "#00F0FF" : "#94A3B8",
            fontSize: "0.68rem",
            fontWeight: 700,
            padding: "0.25rem 0.5rem",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          title="Ativar/desativar prévia da legenda sobre o vídeo"
        >
          {showSubtitlePreview ? <EyeIcon size={12} /> : <EyeOffIcon size={12} />}
          {showSubtitlePreview ? "Prévia ON" : "Prévia OFF"}
        </button>
      </div>

      {/* 1. SELETOR DE FONTES DO SISTEMA (COM DESTAQUE PARA POPPINS BOLD) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#E2E8F0" }}>
            Fonte do Sistema:
          </span>
          <span style={{ fontSize: "0.7rem", color: "#00F0FF", fontWeight: 700 }}>
            {selectedFontName}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.45rem",
            maxHeight: "220px",
            overflowY: "auto",
            paddingRight: "2px",
          }}
        >
          {SYSTEM_FONTS.map((font) => {
            const isSelected =
              selectedFontName.toLowerCase() === font.name.toLowerCase() ||
              selectedFontName.toLowerCase() === font.fontFamily.toLowerCase() ||
              selectedFontName.toLowerCase().includes(font.fontFamily.toLowerCase());

            const isPoppins = font.id === "poppins";

            return (
              <div
                key={font.id}
                onClick={() => onSelectFontName(font.name)}
                style={{
                  padding: "0.5rem 0.6rem",
                  borderRadius: "8px",
                  border: isSelected
                    ? "2px solid #00F0FF"
                    : isPoppins
                    ? "1px solid rgba(0, 240, 255, 0.4)"
                    : "1px solid #282E40",
                  background: isSelected
                    ? "rgba(0, 240, 255, 0.16)"
                    : isPoppins
                    ? "rgba(0, 240, 255, 0.05)"
                    : "#151824",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontFamily: `'${font.fontFamily}', sans-serif`,
                      fontSize: "0.86rem",
                      fontWeight: 800,
                      color: isSelected ? "#00F0FF" : "#FFF",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {font.name}
                  </span>
                  {isSelected && (
                    <Check size={12} style={{ color: "#00F0FF", flexShrink: 0 }} />
                  )}
                </div>
                <span style={{ fontSize: "0.64rem", color: "#64748B" }}>
                  {font.category}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. ESTILO DE ANIMAÇÃO VIRAL */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#E2E8F0" }}>
          Animação &amp; Estilo do Corte:
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
          {[
            { id: "hormozi", name: "Alex Hormozi", desc: "Caixa alta amarela/verde vibrante" },
            { id: "beast", name: "MrBeast Impact", desc: "Destaque neon e alto impacto" },
            { id: "apple", name: "Apple Minimal", desc: "Clean moderno e discreto" },
            { id: "minimal", name: "Legenda Clássica", desc: "Texto sutil com fundo suave" },
          ].map((sub) => {
            const isSelected = subtitleStyle === sub.id;
            return (
              <div
                key={sub.id}
                onClick={() => onSelectSubtitleStyle(sub.id as SubtitleStyle)}
                style={{
                  padding: "0.5rem 0.6rem",
                  background: isSelected ? "rgba(0, 240, 255, 0.12)" : "#151824",
                  borderRadius: "8px",
                  border: `1px solid ${isSelected ? "#00F0FF" : "#282E40"}`,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: "0.78rem", color: isSelected ? "#00F0FF" : "#FFF" }}>
                    {sub.name}
                  </strong>
                </div>
                <span style={{ fontSize: "0.64rem", color: "#64748B", display: "block", marginTop: "0.15rem" }}>
                  {sub.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. CORES PERSONALIZADAS: TEXTO BASE & DESTAQUE KARAOKE */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", background: "#151824", padding: "0.75rem", borderRadius: "8px", border: "1px solid #242938" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Palette size={14} style={{ color: "#00F0FF" }} />
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#E2E8F0" }}>
            Paleta de Cores da Legenda:
          </span>
        </div>

        {/* Cor Primária (Texto Falado Padrão) */}
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

        {/* Cor de Destaque / Karaoke (Palavra Ativa falada) */}
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

      {/* 4. POSIÇÃO VERTICAL & TAMANHO DA FONTE */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div>
          <label style={{ fontSize: "0.72rem", color: "#94A3B8", display: "block", marginBottom: "0.25rem" }}>
            Posição Vertical:
          </label>
          <select
            value={subtitlePosition}
            onChange={(e) => onSubtitlePositionChange(e.target.value as any)}
            style={{
              width: "100%",
              background: "#151824",
              color: "#E2E8F0",
              border: "1px solid #282E40",
              borderRadius: "6px",
              padding: "0.35rem 0.5rem",
              fontSize: "0.74rem",
              cursor: "pointer",
            }}
          >
            <option value="bottom">Base (Safe Zone)</option>
            <option value="center-bottom">Centro-Inferior</option>
            <option value="center">Centro da Tela</option>
          </select>
        </div>

        <div style={{ background: "#10121B", border: "1px solid #242938", borderRadius: "8px", padding: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
            <label style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: 600 }}>
              Tamanho da Fonte das Legendas:
            </label>
            <span style={{ fontSize: "0.72rem", color: "#00F0FF", fontWeight: 700, fontFamily: "monospace" }}>
              {customSubtitleFontSize}px
            </span>
          </div>

          {/* Presets Rápidos */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.3rem", marginBottom: "0.55rem" }}>
            {[
              { label: "Pequena", size: "small" as const, px: 20 },
              { label: "Média", size: "medium" as const, px: 24 },
              { label: "Grande", size: "large" as const, px: 28 },
              { label: "Extra", size: "extra" as const, px: 36 },
            ].map((item) => {
              const isSelected = subtitleFontSize === item.size || customSubtitleFontSize === item.px;
              return (
                <button
                  key={item.size}
                  type="button"
                  onClick={() => onFontSizeChange(item.size, item.px)}
                  style={{
                    padding: "0.25rem 0.2rem",
                    borderRadius: "4px",
                    fontSize: "0.68rem",
                    fontWeight: isSelected ? 700 : 500,
                    background: isSelected ? "#00F0FF20" : "#181C28",
                    color: isSelected ? "#00F0FF" : "#94A3B8",
                    border: isSelected ? "1px solid #00F0FF" : "1px solid #282E40",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Slider Contínuo + Botões de Ajuste Fino (- / +) */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <button
              type="button"
              onClick={() => onStepFontSize(-2)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                background: "#1C202E",
                border: "1px solid #2A3144",
                color: "#E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
              title="Diminuir fonte (-2px)"
            >
              -
            </button>

            <input
              type="range"
              min="14"
              max="54"
              step="1"
              value={customSubtitleFontSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                const nextPreset = val <= 21 ? "small" : val <= 26 ? "medium" : val <= 32 ? "large" : "extra";
                onFontSizeChange(nextPreset, val);
              }}
              onMouseUp={() => {
                onCommitFontSizeHistory?.();
              }}
              onTouchEnd={() => {
                onCommitFontSizeHistory?.();
              }}
              style={{
                flex: 1,
                accentColor: "#00F0FF",
                cursor: "pointer",
                height: "4px",
              }}
            />

            <button
              type="button"
              onClick={() => onStepFontSize(2)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                background: "#1C202E",
                border: "1px solid #2A3144",
                color: "#E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
              title="Aumentar fonte (+2px)"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 5. EMOJIS CONTEXTUAIS AUTOMÁTICOS */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "#151824",
          padding: "0.55rem 0.75rem",
          borderRadius: "8px",
          border: "1px solid #282E40",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={enableEmojis}
          onChange={(e) => onEnableEmojisChange(e.target.checked)}
          style={{ width: "1rem", height: "1rem", accentColor: "#00F0FF", cursor: "pointer" }}
        />
        <span style={{ fontSize: "0.74rem", color: "#E2E8F0" }}>
          Injetar Emojis Automáticos contextuais na fala (🔥, 💰, 🚀, 💡)
        </span>
      </label>
    </div>
  );
}
