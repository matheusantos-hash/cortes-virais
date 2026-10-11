"use client";

import React from "react";
import { Volume2 } from "../Icons";

interface StudioSoundBrollsSectionProps {
  enableSfx: boolean;
  onEnableSfxChange: (val: boolean) => void;
  backgroundMusicDucking: boolean;
  onBackgroundMusicDuckingChange: (val: boolean) => void;
  useBroll: boolean;
  onUseBrollChange: (val: boolean) => void;
  brollSource: "auto" | "none" | "pexels" | "higgsfield";
  onBrollSourceChange: (val: any) => void;
}

export default function StudioSoundBrollsSection({
  enableSfx,
  onEnableSfxChange,
  backgroundMusicDucking,
  onBackgroundMusicDuckingChange,
  useBroll,
  onUseBrollChange,
  brollSource,
  onBrollSourceChange,
}: StudioSoundBrollsSectionProps) {
  return (
    <div className="control-box" style={{ gridColumn: "1 / -1" }}>
      <div className="control-box-header">
        <Volume2 size={17} style={{ color: "var(--primary)" }} />
        <strong>Sound Design &amp; B-Rolls Inteligentes</strong>
      </div>

      <div className="row" style={{ gap: "1.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={enableSfx}
            onChange={(e) => onEnableSfxChange(e.target.checked)}
          />
          <span>SFX de impacto nas transições (Whoosh, Ding, Pop)</span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={backgroundMusicDucking}
            onChange={(e) => onBackgroundMusicDuckingChange(e.target.checked)}
          />
          <span>Auto-Ducking de áudio (reduz trilha durante a fala)</span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={useBroll}
            onChange={(e) => onUseBrollChange(e.target.checked)}
          />
          <span>Sobrepor B-Rolls contextuais com IA</span>
        </label>

        {useBroll && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="muted small">Fonte B-Roll:</span>
            <select
              className="input select"
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
              value={brollSource}
              onChange={(e) => onBrollSourceChange(e.target.value as any)}
            >
              <option value="auto">⚡ Automático (IA Decide - Recomendado)</option>
              <option value="higgsfield">Higgsfield AI (Apenas Gerados por IA)</option>
              <option value="pexels">Pexels / Pixabay (Apenas Vídeos Reais)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
