"use client";

import React from "react";
import { FilmIcon } from "../Icons";

interface AdvancedBrollsSectionProps {
  useBroll: boolean;
  onUseBrollChange: (val: boolean) => void;
  brollSource: "auto" | "pexels" | "higgsfield";
  onBrollSourceChange: (val: "auto" | "pexels" | "higgsfield") => void;
}

export default function AdvancedBrollsSection({
  useBroll,
  onUseBrollChange,
  brollSource,
  onBrollSourceChange,
}: AdvancedBrollsSectionProps) {
  return (
    <div
      className="card"
      style={{
        border: "1px dashed rgba(16, 185, 129, 0.4)",
        background: "rgba(16, 185, 129, 0.03)",
        padding: "0.85rem",
      }}
    >
      <label
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "0.65rem",
          cursor: "pointer",
          margin: 0,
        }}
      >
        <input
          type="checkbox"
          style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--primary)", cursor: "pointer" }}
          checked={useBroll}
          onChange={(e) => onUseBrollChange(e.target.checked)}
        />
        <div>
          <strong
            style={{
              fontSize: "0.92rem",
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <FilmIcon size={15} /> Inserir B-Rolls automáticos nos momentos-chave
          </strong>
          <small style={{ display: "block", color: "var(--text-muted)" }}>
            Intercala vídeos de apoio em Full HD para aumentar a retenção.
          </small>
        </div>
      </label>

      {useBroll && (
        <div style={{ marginTop: "0.75rem", paddingTop: "0.65rem", borderTop: "1px solid var(--card-border)" }}>
          <label>
            Provedor de B-Roll:
            <select
              value={brollSource}
              onChange={(e) => onBrollSourceChange(e.target.value as "auto" | "pexels" | "higgsfield")}
            >
              <option value="auto">⚡ Automático (IA Decide - Recomendado)</option>
              <option value="higgsfield">Higgsfield AI (Apenas Gerados por IA)</option>
              <option value="pexels">Pixabay / Pexels (Apenas Vídeos Reais)</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
