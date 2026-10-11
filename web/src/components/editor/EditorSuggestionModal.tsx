"use client";

import React from "react";
import { Lightbulb, X } from "../Icons";
import { BrollPreviewCanvas } from "../CanvasBrollOverlay";
import type { BrollTriggerSuggestion } from "@/lib/detectBrollTriggers";
import type { CanvasBroll } from "@/lib/types";

interface EditorSuggestionModalProps {
  previewSuggestion: BrollTriggerSuggestion;
  onClose: () => void;
  canvasBrolls: CanvasBroll[];
  onApplySuggestion: (suggestion: BrollTriggerSuggestion) => void;
}

export default function EditorSuggestionModal({
  previewSuggestion,
  onClose,
  canvasBrolls,
  onApplySuggestion,
}: EditorSuggestionModalProps) {
  const isAdded = canvasBrolls.some((b) => Math.abs(b.offsetSec - previewSuggestion.offsetSec) < 0.5);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "min(92vh, 560px)",
          background: "#12151D",
          border: "1px solid #2B3042",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid #222634",
            background: "rgba(255, 255, 255, 0.02)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(245, 158, 11, 0.15)",
                color: "#F59E0B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Lightbulb size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.96rem", fontWeight: 800, color: "#FFFFFF" }}>
                Sugestão de Retenção da IA
              </h3>
              <span style={{ fontSize: "0.74rem", color: "#94A3B8" }}>
                Momento aos <strong style={{ color: "#22D3EE", fontFamily: "monospace" }}>{previewSuggestion.offsetSec}s</strong> do corte
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            className="hover:text-white hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com Scroll: Lado a Lado (Prévia 9:16 + Detalhes Explicativos) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "18px",
            alignItems: "center",
          }}
        >
          {/* Lado Esquerdo: Card com Mockup 9:16 e Animação ao Vivo */}
          <div
            style={{
              flex: "0 0 155px",
              margin: "0 auto",
              borderRadius: "14px",
              background: "radial-gradient(ellipse at top, #1A2030 0%, #080A10 100%)",
              border: "1px solid #252B3D",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#38BDF8", textTransform: "uppercase" }}>
                Prévia 9:16
              </span>
              <span
                style={{
                  fontSize: "0.64rem",
                  padding: "1px 6px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10B981",
                  fontWeight: 700,
                }}
              >
                ● Ao vivo
              </span>
            </div>

            {/* Mockup Vertical com Canvas */}
            <div
              style={{
                width: "135px",
                height: "215px",
                borderRadius: "12px",
                overflow: "hidden",
                position: "relative",
                background: "#05070B",
                boxShadow: "0 6px 16px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "6px",
                  border: "1px dashed rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  pointerEvents: "none",
                }}
              />

              <BrollPreviewCanvas
                broll={{
                  id: "preview-modal-" + previewSuggestion.template,
                  offsetSec: 0,
                  durationSec: previewSuggestion.durationSec || 3.0,
                  template: previewSuggestion.template,
                  data: {
                    title: previewSuggestion.suggestedTitle,
                    value: previewSuggestion.suggestedValue,
                    subtitle: previewSuggestion.suggestedSubtitle,
                    color: previewSuggestion.suggestedColor,
                    positionY: "top",
                  },
                }}
              />
            </div>
          </div>

          {/* Lado Direito: Informações e Benefício de Retenção */}
          <div
            style={{
              flex: "1 1 280px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Gatilho de Fala */}
            <div
              style={{
                background: "#161922",
                border: "1px solid #232736",
                borderRadius: "10px",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span
                style={{
                  padding: "3px 7px",
                  borderRadius: "5px",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#38BDF8",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                }}
              >
                Gatilho de Fala
              </span>
              <div style={{ fontSize: "0.82rem", color: "#E2E8F0" }}>
                Termo <strong style={{ color: "#FFE600" }}>&ldquo;{previewSuggestion.word}&rdquo;</strong> aos{" "}
                <strong>{previewSuggestion.offsetSec}s</strong>
              </div>
            </div>

            {/* Por que a IA sugeriu */}
            <div
              style={{
                background: "#161922",
                border: "1px solid #232736",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "0.8rem",
                color: "#94A3B8",
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: "#F1F5F9", display: "block", marginBottom: "3px" }}>
                🎯 Por que inserir este elemento:
              </strong>
              {previewSuggestion.template === "metric_counter" &&
                "Números falados sem apoio visual geram dispersão. Este contador progressivo ancora a atenção e comprova o resultado informado."}
              {previewSuggestion.template === "growth_chart" &&
                "Momentos de escalada e evolução causam pico de dopamina quando acompanhados de uma curva ascendente em neon."}
              {previewSuggestion.template === "glass_alert" &&
                "O alerta glassmorphism cria um choque visual de alta relevância, garantindo que o espectador não perca o aviso crucial."}
              {previewSuggestion.template === "viral_tag" &&
                "Tags chanfradas marcam o conceito principal do corte e incentivam salvamentos para consulta posterior."}
            </div>

            {/* Configurações em Grade */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px 12px",
                background: "rgba(0,0,0,0.25)",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.74rem",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div>
                <span style={{ color: "#64748B" }}>Template: </span>
                <strong style={{ color: "#FFF" }}>{previewSuggestion.template}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Duração: </span>
                <strong style={{ color: "#FFF" }}>{previewSuggestion.durationSec}s</strong>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Título: </span>
                <strong style={{ color: "#FFF" }}>{previewSuggestion.suggestedTitle}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Destaque: </span>
                <strong style={{ color: "#22D3EE" }}>{previewSuggestion.suggestedValue}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com botões de ação */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "12px 20px",
            borderTop: "1px solid #222634",
            background: "rgba(0,0,0,0.2)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "8px",
              border: "1px solid #33394D",
              background: "transparent",
              color: "#94A3B8",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
            className="hover:text-white hover:bg-white/5"
          >
            Fechar
          </button>

          <button
            type="button"
            disabled={isAdded}
            onClick={() => {
              onApplySuggestion(previewSuggestion);
              onClose();
            }}
            style={{
              padding: "0.45rem 1.2rem",
              borderRadius: "8px",
              border: "none",
              background: isAdded ? "#1E293B" : "var(--primary, #4F46E5)",
              color: isAdded ? "#64748B" : "#FFFFFF",
              cursor: isAdded ? "default" : "pointer",
              fontSize: "0.8rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            className={isAdded ? "" : "hover:brightness-110 active:scale-95"}
          >
            {isAdded ? "Já Adicionado" : "Aplicar Elemento no Vídeo"}
          </button>
        </div>
      </div>
    </div>
  );
}
