"use client";

import React from "react";
import { Zap, Shield, Cpu, Check, Save } from "../Icons";

interface AdvancedTranscriptionSectionProps {
  transcriptionProvider: "auto" | "deepgram" | "gemini";
  onProviderChange: (provider: "auto" | "deepgram" | "gemini") => void;
  onSaveDefault: () => void;
  savingDefault: boolean;
  savedSuccess: boolean;
}

export default function AdvancedTranscriptionSection({
  transcriptionProvider,
  onProviderChange,
  onSaveDefault,
  savingDefault,
  savedSuccess,
}: AdvancedTranscriptionSectionProps) {
  return (
    <div
      className="card stack"
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--card-border)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div>
          <strong
            style={{
              fontSize: "0.95rem",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              color: "var(--text)",
            }}
          >
            <Zap size={16} style={{ color: "var(--primary)" }} /> Motor de Transcrição &amp; IA de Áudio
          </strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: "0.15rem" }}>
            Escolha a inteligência usada para mapear falas, timestamps e eventos sonoros.
          </small>
        </div>

        <button
          type="button"
          onClick={onSaveDefault}
          disabled={savingDefault}
          className="btn-ghost"
          style={{
            fontSize: "0.78rem",
            padding: "0.3rem 0.65rem",
            borderRadius: "6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            border: savedSuccess ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid var(--card-border)",
            color: savedSuccess ? "#10b981" : "var(--text-muted)",
            background: savedSuccess ? "rgba(16, 185, 129, 0.1)" : "transparent",
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
          title="Salva este provedor como preferência padrão para seus próximos vídeos"
        >
          {savedSuccess ? (
            <>
              <Check size={13} /> Padrão Salvo!
            </>
          ) : (
            <>
              <Save size={13} /> Salvar como Padrão
            </>
          )}
        </button>
      </div>

      <div
        className="selection-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginTop: "0.4rem" }}
      >
        {/* Card Auto / Fallback */}
        <div
          className={`selection-card ${transcriptionProvider === "auto" ? "active" : ""}`}
          onClick={() => onProviderChange("auto")}
          style={{ cursor: "pointer", position: "relative" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.25rem",
            }}
          >
            <Shield
              size={20}
              style={{ color: transcriptionProvider === "auto" ? "var(--primary)" : "var(--text-muted)" }}
            />
            <span className="badge badge-done" style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}>
              Recomendado
            </span>
          </div>
          <div className="selection-card-title">Auto + Fallback</div>
          <span className="selection-card-desc">
            Usa Deepgram Nova-3. Se a cota acabar ou houver erro, alterna para o Gemini Pro sem travar o vídeo.
          </span>
        </div>

        {/* Card Deepgram */}
        <div
          className={`selection-card ${transcriptionProvider === "deepgram" ? "active" : ""}`}
          onClick={() => onProviderChange("deepgram")}
          style={{ cursor: "pointer" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.25rem",
            }}
          >
            <Zap
              size={20}
              style={{ color: transcriptionProvider === "deepgram" ? "var(--primary)" : "var(--text-muted)" }}
            />
            <span
              className="badge"
              style={{
                fontSize: "0.65rem",
                padding: "0.1rem 0.4rem",
                background: "rgba(99, 102, 241, 0.15)",
                color: "#a5b4fc",
              }}
            >
              Nova-3
            </span>
          </div>
          <div className="selection-card-title">Deepgram Nova-3</div>
          <span className="selection-card-desc">
            Velocidade ultrarrápida com precisão milimétrica palavra por palavra para legendas karaokê dinâmicas.
          </span>
        </div>

        {/* Card Gemini Pro */}
        <div
          className={`selection-card ${transcriptionProvider === "gemini" ? "active" : ""}`}
          onClick={() => onProviderChange("gemini")}
          style={{ cursor: "pointer" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.25rem",
            }}
          >
            <Cpu
              size={20}
              style={{ color: transcriptionProvider === "gemini" ? "var(--primary)" : "var(--text-muted)" }}
            />
            <span
              className="badge"
              style={{
                fontSize: "0.65rem",
                padding: "0.1rem 0.4rem",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
              }}
            >
              Multimodal
            </span>
          </div>
          <div className="selection-card-title">Google Gemini Pro</div>
          <span className="selection-card-desc">
            Analisa áudio nativamente com tags de risos, aplausos e emoção. Econômico e suporta horas de vídeo.
          </span>
        </div>
      </div>
    </div>
  );
}
