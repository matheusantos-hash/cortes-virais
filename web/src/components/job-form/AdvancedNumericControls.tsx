"use client";

import React from "react";

interface AdvancedNumericControlsProps {
  clipCount: number;
  onClipCountChange: (val: number) => void;
  minSeconds: number;
  onMinSecondsChange: (val: number) => void;
  maxSeconds: number;
  onMaxSecondsChange: (val: number) => void;
  language: string;
  onLanguageChange: (val: string) => void;
}

export default function AdvancedNumericControls({
  clipCount,
  onClipCountChange,
  minSeconds,
  onMinSecondsChange,
  maxSeconds,
  onMaxSecondsChange,
  language,
  onLanguageChange,
}: AdvancedNumericControlsProps) {
  return (
    <>
      {/* Controles de Ajuste Numérico */}
      <div className="grid3">
        <label>
          Qtd. de cortes
          <input
            type="number"
            min={1}
            max={20}
            value={clipCount}
            onChange={(e) => onClipCountChange(Number(e.target.value))}
          />
        </label>
        <label>
          Duração Mín. (s)
          <input
            type="number"
            min={5}
            max={3600}
            value={minSeconds}
            onChange={(e) => onMinSecondsChange(Number(e.target.value))}
          />
          {minSeconds >= 60 && (
            <small className="muted">
              {Math.floor(minSeconds / 60)}m {minSeconds % 60 ? `${minSeconds % 60}s` : ""}
            </small>
          )}
        </label>
        <label>
          Duração Máx. (s)
          <input
            type="number"
            min={10}
            max={3600}
            value={maxSeconds}
            onChange={(e) => onMaxSecondsChange(Number(e.target.value))}
          />
          {maxSeconds >= 60 && (
            <small className="muted">
              {Math.floor(maxSeconds / 60)}m {maxSeconds % 60 ? `${maxSeconds % 60}s` : ""}
            </small>
          )}
        </label>
      </div>

      <label>
        Idioma Falado no Vídeo
        <select value={language} onChange={(e) => onLanguageChange(e.target.value)}>
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en">Inglês</option>
          <option value="es">Espanhol</option>
        </select>
      </label>
    </>
  );
}
