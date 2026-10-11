"use client";

import React from "react";

interface AdvancedCurationSectionProps {
  enableVisualAnalysis: boolean;
  onEnableVisualAnalysisChange: (val: boolean) => void;
  enableExtendedThinking: boolean;
  onEnableExtendedThinkingChange: (val: boolean) => void;
}

export default function AdvancedCurationSection({
  enableVisualAnalysis,
  onEnableVisualAnalysisChange,
  enableExtendedThinking,
  onEnableExtendedThinkingChange,
}: AdvancedCurationSectionProps) {
  return (
    <div
      className="card stack"
      style={{
        background: "rgba(99, 102, 241, 0.03)",
        border: "1px solid rgba(99, 102, 241, 0.25)",
        padding: "1rem",
      }}
    >
      <div>
        <strong style={{ fontSize: "0.95rem", color: "var(--primary)" }}>
          Curadoria Inteligente &amp; Raciocínio Profundo
        </strong>
        <small style={{ color: "var(--text-muted)", display: "block", marginTop: "0.15rem" }}>
          Tecnologia de visão computacional e inteligência editorial para maximizar retenção e taxas de visualização.
        </small>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "0.75rem",
          marginTop: "0.25rem",
        }}
      >
        {/* Card Gemini Agentic Video */}
        <label
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "0.65rem",
            cursor: "pointer",
            padding: "0.75rem",
            borderRadius: "8px",
            background: enableVisualAnalysis ? "rgba(99, 102, 241, 0.08)" : "rgba(255, 255, 255, 0.02)",
            border: enableVisualAnalysis ? "1px solid var(--primary)" : "1px solid var(--card-border)",
            transition: "all 0.2s ease",
            margin: 0,
          }}
        >
          <input
            type="checkbox"
            style={{ width: "1.15rem", height: "1.15rem", accentColor: "var(--primary)", marginTop: "0.15rem", cursor: "pointer" }}
            checked={enableVisualAnalysis}
            onChange={(e) => onEnableVisualAnalysisChange(e.target.checked)}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <strong style={{ fontSize: "0.88rem", color: "var(--text)" }}>Gemini Agentic Vision</strong>
              <span className="badge badge-done" style={{ fontSize: "0.65rem", padding: "0.08rem 0.35rem" }}>
                IA Visual
              </span>
            </div>
            <small style={{ display: "block", color: "var(--text-muted)", marginTop: "0.2rem", fontSize: "0.78rem", lineHeight: 1.35 }}>
              A IA assiste ao vídeo dinamicamente buscando picos de expressão facial, gestos e telas para priorizar cortes de alto impacto visual.
            </small>
          </div>
        </label>

        {/* Card Claude Extended Thinking */}
        <label
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "0.65rem",
            cursor: "pointer",
            padding: "0.75rem",
            borderRadius: "8px",
            background: enableExtendedThinking ? "rgba(99, 102, 241, 0.08)" : "rgba(255, 255, 255, 0.02)",
            border: enableExtendedThinking ? "1px solid var(--primary)" : "1px solid var(--card-border)",
            transition: "all 0.2s ease",
            margin: 0,
          }}
        >
          <input
            type="checkbox"
            style={{ width: "1.15rem", height: "1.15rem", accentColor: "var(--primary)", marginTop: "0.15rem", cursor: "pointer" }}
            checked={enableExtendedThinking}
            onChange={(e) => onEnableExtendedThinkingChange(e.target.checked)}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <strong style={{ fontSize: "0.88rem", color: "var(--text)" }}>Claude Extended Thinking</strong>
              <span className="badge badge-done" style={{ fontSize: "0.65rem", padding: "0.08rem 0.35rem" }}>
                Raciocínio
              </span>
            </div>
            <small style={{ display: "block", color: "var(--text-muted)", marginTop: "0.2rem", fontSize: "0.78rem", lineHeight: 1.35 }}>
              Ativa cota de raciocínio profundo no Claude para planejar arcos narrativos autocontidos e ganchos magnéticos nos primeiros 3s.
            </small>
          </div>
        </label>
      </div>
    </div>
  );
}
