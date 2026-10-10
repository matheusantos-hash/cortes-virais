"use client";

import React from "react";
import { Check, Palette } from "lucide-react";

export interface PresetColor {
  color: string;
  name: string;
}

export interface ModernColorPickerProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
  presetColors?: PresetColor[];
  compact?: boolean;
  style?: React.CSSProperties;
}

const DEFAULT_PRESETS: PresetColor[] = [
  { color: "#FFFFFF", name: "Branco" },
  { color: "#FACC15", name: "Amarelo" },
  { color: "#00F0FF", name: "Ciano" },
  { color: "#10B981", name: "Verde" },
  { color: "#FF007A", name: "Magenta" },
];

export default function ModernColorPicker({
  label,
  color,
  onChange,
  presetColors = DEFAULT_PRESETS,
  compact = false,
  style,
}: ModernColorPickerProps) {
  const normalizedColor = color?.startsWith("#") ? color.toUpperCase() : `#${color || "FFFFFF"}`.toUpperCase();

  // MODO COMPACTO (Perfeito para a Home / NewJobForm e Modais Compactos)
  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          width: "100%",
          ...style,
        }}
      >
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--text-muted, #94A3B8)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            minWidth: "130px",
          }}
        >
          <Palette size={13} style={{ color: "var(--primary, #6366f1)" }} />
          {label}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Swatches Redondos SVG */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {presetColors.map((c) => {
              const isSelected = normalizedColor === c.color.toUpperCase();
              const isLight = c.color.toUpperCase() === "#FFFFFF" || c.color.toUpperCase() === "#FACC15";

              return (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => onChange(c.color)}
                  style={{
                    width: "22px",
                    height: "22px",
                    minWidth: "22px",
                    minHeight: "22px",
                    maxWidth: "22px",
                    maxHeight: "22px",
                    aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    background: c.color,
                    border: c.color.toUpperCase() === "#FFFFFF" ? "1px solid #94A3B8" : "1px solid rgba(0,0,0,0.15)",
                    cursor: "pointer",
                    padding: 0,
                    margin: 0,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    boxShadow: isSelected
                      ? "0 0 0 2px var(--card-bg, #0F172A), 0 0 0 3.5px var(--primary, #6366F1), 0 2px 6px rgba(99, 102, 241, 0.4)"
                      : "0 1px 3px rgba(0, 0, 0, 0.2)",
                    transform: isSelected ? "scale(1.12)" : "scale(1)",
                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  title={`${c.name} (${c.color})`}
                >
                  {isSelected && (
                    <Check
                      size={12}
                      strokeWidth={3}
                      style={{
                        color: isLight ? "#0F172A" : "#FFFFFF",
                        filter: isLight ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Pizza de Cores (Color Wheel Circular Conic Gradient) */}
          <div
            style={{
              position: "relative",
              width: "24px",
              height: "24px",
              minWidth: "24px",
              minHeight: "24px",
              borderRadius: "50%",
              aspectRatio: "1 / 1",
              background:
                "conic-gradient(from 0deg, #FF0000 0deg, #FF7700 45deg, #FFFF00 90deg, #00FF00 135deg, #00FFFF 180deg, #0055FF 225deg, #9900FF 270deg, #FF0077 315deg, #FF0000 360deg)",
              boxShadow: "0 2px 5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "transform 0.15s ease",
            }}
            title="Pizza de Cores / Roda Cromática - Clique para escolher qualquer cor personalizada"
          >
            {/* Ponto / Miolo central com a cor atualmente ativa */}
            <div
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: normalizedColor,
                border: "1.5px solid #FFFFFF",
                boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
                pointerEvents: "none",
              }}
            />
            <input
              type="color"
              value={normalizedColor}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
                borderRadius: "50%",
                border: "none",
                padding: 0,
              }}
              title="Abrir Roda de Cores Personalizada"
            />
          </div>

          {/* Mini Badge / Input Hex */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(0, 0, 0, 0.35)",
              border: "1px solid var(--card-border, #475569)",
              borderRadius: "6px",
              padding: "1px 6px",
              height: "22px",
            }}
          >
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted, #94A3B8)", marginRight: "2px" }}>
              #
            </span>
            <input
              type="text"
              value={normalizedColor.replace(/^#/, "")}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
                onChange(`#${val}`.toUpperCase());
              }}
              maxLength={6}
              placeholder="FFFFFF"
              style={{
                width: "50px",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--text, #F8FAFC)",
                textAlign: "left",
                fontFamily: "monospace",
                textTransform: "uppercase",
              }}
              title="Código HEX da cor"
            />
          </div>
        </div>
      </div>
    );
  }

  // MODO CARD COMPLETO (Padrão para Studios / Editores Avançados)
  return (
    <div
      style={{
        padding: "0.85rem 1rem",
        background: "var(--card-bg, #FFFFFF)",
        borderRadius: "12px",
        border: "1px solid var(--card-border, #E2E8F0)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.65rem" }}>
        <label className="field-label" style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Palette size={15} style={{ color: "var(--primary)" }} />
          {label}
        </label>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--card-border)" }}>
          <span
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: normalizedColor,
              display: "inline-block",
              border: "1px solid rgba(0, 0, 0, 0.15)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "var(--text)", fontWeight: 700, fontFamily: "monospace" }}>
            {normalizedColor}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        {/* Swatches Redondos com Vetores SVG */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {presetColors.map((c) => {
            const isSelected = normalizedColor === c.color.toUpperCase();
            const isLight = c.color.toUpperCase() === "#FFFFFF" || c.color.toUpperCase() === "#FACC15";

            return (
              <button
                key={c.color}
                type="button"
                onClick={() => onChange(c.color)}
                style={{
                  width: "32px",
                  height: "32px",
                  minWidth: "32px",
                  minHeight: "32px",
                  maxWidth: "32px",
                  maxHeight: "32px",
                  aspectRatio: "1 / 1",
                  borderRadius: "50%",
                  background: c.color,
                  border: c.color.toUpperCase() === "#FFFFFF" ? "1px solid #CBD5E1" : "1px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                  margin: 0,
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  boxShadow: isSelected
                    ? "0 0 0 2px var(--card-bg, #FFFFFF), 0 0 0 4px var(--primary, #4F46E5), 0 2px 8px rgba(79, 70, 229, 0.35)"
                    : "0 1px 3px rgba(0, 0, 0, 0.12)",
                  transform: isSelected ? "scale(1.08)" : "scale(1)",
                  transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                title={`${c.name} (${c.color})`}
              >
                {isSelected && (
                  <Check
                    size={16}
                    strokeWidth={3}
                    style={{
                      color: isLight ? "#0F172A" : "#FFFFFF",
                      filter: isLight ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Pizza de Cores (Color Wheel Conic Gradient) + Input Hex */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              position: "relative",
              width: "34px",
              height: "34px",
              minWidth: "34px",
              minHeight: "34px",
              borderRadius: "50%",
              aspectRatio: "1 / 1",
              background:
                "conic-gradient(from 0deg, #FF0000 0deg, #FF7700 45deg, #FFFF00 90deg, #00FF00 135deg, #00FFFF 180deg, #0055FF 225deg, #9900FF 270deg, #FF0077 315deg, #FF0000 360deg)",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15), 0 0 0 1px var(--card-border, #CBD5E1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            title="Pizza de Cores / Roda Cromática - Clique para escolher qualquer cor"
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: normalizedColor,
                border: "2px solid #FFFFFF",
                boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                pointerEvents: "none",
              }}
            />
            <input
              type="color"
              value={normalizedColor}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
                borderRadius: "50%",
                border: "none",
                padding: 0,
              }}
              title="Abrir Roda de Cores Personalizada"
            />
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "var(--card-bg, #FFFFFF)",
              border: "1px solid var(--card-border, #CBD5E1)",
              borderRadius: "8px",
              padding: "3px 8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginRight: "2px" }}>
              #
            </span>
            <input
              type="text"
              value={normalizedColor.replace(/^#/, "")}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
                onChange(`#${val}`.toUpperCase());
              }}
              maxLength={6}
              placeholder="FFFFFF"
              style={{
                width: "65px",
                fontSize: "0.82rem",
                fontWeight: 700,
                padding: "2px 0",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--text)",
                textAlign: "left",
                fontFamily: "monospace",
                textTransform: "uppercase",
              }}
              title="Digite o código HEX da cor"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
