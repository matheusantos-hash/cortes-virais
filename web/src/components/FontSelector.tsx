"use client";

import React, { useState, useRef } from "react";
import { SYSTEM_FONTS, type SystemFont } from "@/lib/systemFonts";
import FontSpecimenModal from "./FontSpecimenModal";
import { Type, EyeIcon, Upload, Trash2, Check, Sparkles, ChevronDown } from "./Icons";

interface FontSelectorProps {
  selectedFontName: string;
  onSelectFontName: (fontName: string, fontPath?: string | null) => void;
  onSelectCustomFile?: (file: File) => void;
  customFontFile?: File | null;
  customFontPath?: string | null;
  onClearCustomFont?: () => void;
  primaryColor?: string;
  highlightColor?: string;
  isInheritedFromStyle?: boolean;
  styleName?: string;
}

export default function FontSelector({
  selectedFontName,
  onSelectFontName,
  onSelectCustomFile,
  customFontFile,
  customFontPath,
  onClearCustomFont,
  primaryColor = "#FFFFFF",
  highlightColor = "#FACC15",
  isInheritedFromStyle = false,
  styleName,
}: FontSelectorProps) {
  const [specimenFont, setSpecimenFont] = useState<SystemFont | null>(null);
  const [isSpecimenOpen, setIsSpecimenOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Encontra se a fonte atual é uma fonte do sistema
  const currentSystemFont = SYSTEM_FONTS.find(
    (f) =>
      f.name.toLowerCase() === selectedFontName.toLowerCase() ||
      f.fontFamily.toLowerCase() === selectedFontName.toLowerCase() ||
      selectedFontName.toLowerCase().includes(f.fontFamily.toLowerCase())
  );

  function handleOpenSpecimen(font: SystemFont, e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setSpecimenFont(font);
    setIsSpecimenOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onSelectCustomFile?.(file);
    }
  }

  return (
    <div className="font-selector-root stack" style={{ gap: "0.5rem" }}>
      {/* Cabeçalho do Bloco */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.2rem" }}>
        <label className="field-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
          <Type size={15} style={{ color: "var(--primary)" }} />
          Tipografia &amp; Fonte das Legendas
        </label>
        {isInheritedFromStyle && !customFontFile && (
          <span className="badge badge-accent" style={{ fontSize: "0.68rem" }}>
            Herdada de {styleName || "Estilo"}
          </span>
        )}
      </div>

      {/* Grid de Seleção Rápida de Fontes Virais Embutidas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: "0.45rem",
        }}
      >
        {SYSTEM_FONTS.map((font) => {
          const isSelected =
            !customFontFile &&
            (selectedFontName === font.name ||
              selectedFontName === font.fontFamily ||
              selectedFontName.toLowerCase().includes(font.fontFamily.toLowerCase()));

          return (
            <div
              key={font.id}
              onClick={() => onSelectFontName(font.name)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.65rem",
                borderRadius: "8px",
                border: isSelected ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                background: isSelected ? "rgba(139, 92, 246, 0.12)" : "var(--bg-subtle)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={`Clique para selecionar ${font.name}`}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: `'${font.fontFamily}', sans-serif`,
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    color: isSelected ? "var(--primary)" : "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {font.name}
                </span>
                <small className="muted" style={{ fontSize: "0.68rem" }}>
                  {font.category}
                </small>
              </div>

              {/* ÍCONE DE OLHO (👁️) PARA ABRIR O MODAL DE AMOSTRA */}
              <button
                type="button"
                className="btn-icon"
                onClick={(e) => handleOpenSpecimen(font, e)}
                title={`Ver amostra completa de ${font.name} (letras, números e negrito on/off)`}
                style={{
                  background: isSelected ? "rgba(139, 92, 246, 0.2)" : "transparent",
                  border: "none",
                  color: isSelected ? "var(--primary)" : "var(--text-muted)",
                  padding: "4px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: "4px",
                }}
              >
                <EyeIcon size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Opção de Enviar Arquivo de Fonte Própria (.ttf, .otf, .woff) */}
      <div style={{ marginTop: "0.3rem" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2,application/x-font-ttf,application/x-font-otf"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {customFontFile || (customFontPath && !currentSystemFont) ? (
          <div
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--primary)",
              borderRadius: "8px",
              padding: "0.55rem 0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "var(--primary)", fontWeight: 700, fontSize: "0.82rem" }}>
                  ✓ {customFontFile?.name || selectedFontName || "Fonte Própria Enviada"}
                </span>
                {customFontFile && (
                  <span className="muted" style={{ fontSize: "0.68rem" }}>
                    ({Math.round(customFontFile.size / 1024)} KB)
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
              >
                Trocar Arquivo
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  onClearCustomFont?.();
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                style={{ padding: "4px", color: "var(--danger)", background: "transparent", border: "none", cursor: "pointer" }}
                title="Remover fonte e voltar para fonte embutida"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            style={{
              width: "100%",
              fontSize: "0.78rem",
              padding: "0.45rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              borderStyle: "dashed",
              cursor: "pointer",
            }}
          >
            <Upload size={13} />
            Ou envie outro arquivo próprio (.ttf, .otf, .woff)
          </button>
        )}
      </div>

      {/* Modal de Amostra com Letras, Números e Negrito ON/OFF */}
      <FontSpecimenModal
        isOpen={isSpecimenOpen}
        onClose={() => setIsSpecimenOpen(false)}
        font={specimenFont}
        onSelectFont={(font) => {
          onSelectFontName(font.name);
          onClearCustomFont?.();
        }}
        primaryColor={primaryColor}
        highlightColor={highlightColor}
      />
    </div>
  );
}
