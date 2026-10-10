"use client";

import React, { useState } from "react";
import type { SystemFont } from "@/lib/systemFonts";
import { X, Check, Type, EyeIcon } from "./Icons";

interface FontSpecimenModalProps {
  isOpen: boolean;
  onClose: () => void;
  font: SystemFont | null;
  onSelectFont: (font: SystemFont) => void;
  primaryColor?: string;
  highlightColor?: string;
}

export default function FontSpecimenModal({
  isOpen,
  onClose,
  font,
  onSelectFont,
  primaryColor = "#FFFFFF",
  highlightColor = "#FACC15",
}: FontSpecimenModalProps) {
  const [isBold, setIsBold] = useState(true);
  const [fontSize, setFontSize] = useState<number>(36);
  const [customText, setCustomText] = useState("");

  if (!isOpen || !font) return null;

  const previewPhrase = customText.trim() || font.sampleText;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10120,
        background: "rgba(10, 15, 29, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "rgba(139, 92, 246, 0.15)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Type size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{font.name}</h3>
                <span className="badge badge-accent" style={{ fontSize: "0.7rem" }}>
                  {font.category}
                </span>
              </div>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                {font.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Ferramentas / Controles (Toggle Negrito ON/OFF + Tamanho + Cores) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            background: "var(--bg-subtle)",
            borderRadius: "10px",
            marginBottom: "1rem",
            border: "1px solid var(--card-border)",
          }}
        >
          {/* BOTÃO LIGA / DESLIGA NEGRITO (ON/OFF) */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>Negrito (Bold):</span>
            <button
              type="button"
              onClick={() => setIsBold(!isBold)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                border: isBold ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                background: isBold ? "var(--primary)" : "rgba(100, 116, 139, 0.2)",
                color: isBold ? "#FFFFFF" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.78rem",
                transition: "all 0.2s ease",
              }}
              title="Alternar entre peso normal e negrito"
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: isBold ? "#10B981" : "#94A3B8",
                  display: "inline-block",
                }}
              />
              {isBold ? "LIGADO (ON)" : "DESLIGADO (OFF)"}
            </button>
          </div>

          {/* Controle de Tamanho */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Tamanho:</span>
            {[24, 34, 46].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setFontSize(sz)}
                style={{
                  padding: "2px 8px",
                  fontSize: "0.75rem",
                  borderRadius: "6px",
                  border: fontSize === sz ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                  background: fontSize === sz ? "rgba(139, 92, 246, 0.15)" : "transparent",
                  color: fontSize === sz ? "var(--primary)" : "var(--text-muted)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {sz}px
              </button>
            ))}
          </div>
        </div>

        {/* Corpo Rolável de Amostras */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            paddingRight: "4px",
          }}
        >
          {/* AMOSTRA 1: FRASE DE IMPACTO VIRAL (PREVIEW REAL DE VÍDEO) */}
          <div
            style={{
              background: "radial-gradient(ellipse at center, rgba(30, 41, 59, 0.7) 0%, rgba(10, 15, 29, 0.95) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "1.25rem",
              textAlign: "center",
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Preview de Vídeo com Estilo Viral
              </span>
              <span className="badge" style={{ fontSize: "0.68rem", background: "rgba(16, 185, 129, 0.15)", color: "#10B981" }}>
                {isBold ? "Extra Bold 900" : "Regular 400"}
              </span>
            </div>

            <div
              style={{
                fontFamily: `'${font.fontFamily}', sans-serif`,
                fontSize: `${fontSize}px`,
                fontWeight: isBold ? 900 : 400,
                lineHeight: 1.25,
                letterSpacing: "0.5px",
                wordBreak: "break-word",
                color: primaryColor,
                textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 8px rgba(0,0,0,0.8)",
                padding: "0.5rem 0",
              }}
            >
              {previewPhrase}
            </div>

            {/* Campo para testar texto personalizado */}
            <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="text"
                placeholder="Digite qualquer frase para testar em tempo real…"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: "0.82rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "rgba(15, 23, 42, 0.6)",
                  color: "#FFFFFF",
                }}
              />
              {customText && (
                <button
                  type="button"
                  onClick={() => setCustomText("")}
                  className="btn btn-secondary btn-small"
                  style={{ fontSize: "0.72rem", padding: "0.45rem 0.65rem" }}
                >
                  Restaurar
                </button>
              )}
            </div>
          </div>

          {/* AMOSTRA 2: ALFABETO MAIÚSCULO */}
          <div style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "1rem", border: "1px solid var(--card-border)" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              🔤 Alfabeto Maiúsculo (A-Z) &amp; Acentuações PT-BR
            </span>
            <div
              style={{
                fontFamily: `'${font.fontFamily}', sans-serif`,
                fontSize: "1.25rem",
                fontWeight: isBold ? 900 : 400,
                color: "var(--text)",
                letterSpacing: "2px",
                lineHeight: 1.5,
              }}
            >
              A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
              <br />
              Á É Í Ó Ú Â Ê Ô Ã Õ Ç
            </div>
          </div>

          {/* AMOSTRA 3: ALFABETO MINÚSCULO */}
          <div style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "1rem", border: "1px solid var(--card-border)" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              🔡 Alfabeto Minúsculo (a-z)
            </span>
            <div
              style={{
                fontFamily: `'${font.fontFamily}', sans-serif`,
                fontSize: "1.25rem",
                fontWeight: isBold ? 900 : 400,
                color: "var(--text)",
                letterSpacing: "2px",
                lineHeight: 1.5,
              }}
            >
              a b c d e f g h i j k l m n o p q r s t u v w x y z
              <br />
              á é í ó ú â ê ô ã õ ç
            </div>
          </div>

          {/* AMOSTRA 4: NÚMEROS E SÍMBOLOS MONETÁRIOS */}
          <div style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "1rem", border: "1px solid var(--card-border)" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              🔢 Números &amp; Símbolos de Retenção
            </span>
            <div
              style={{
                fontFamily: `'${font.fontFamily}', sans-serif`,
                fontSize: "1.3rem",
                fontWeight: isBold ? 900 : 400,
                color: "var(--text)",
                letterSpacing: "3px",
                lineHeight: 1.5,
              }}
            >
              0 1 2 3 4 5 6 7 8 9
              <br />
              R$ $ % @ # ! ? &amp; * + - / =
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--card-border)",
            gap: "0.5rem",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: "0.6rem 1.2rem" }}
          >
            Fechar
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSelectFont(font);
              onClose();
            }}
            style={{
              padding: "0.6rem 1.4rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 700,
            }}
          >
            <Check size={16} />
            <span>Usar Esta Fonte no Corte</span>
          </button>
        </div>
      </div>
    </div>
  );
}
