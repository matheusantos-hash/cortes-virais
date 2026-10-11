"use client";

import React from "react";
import { Video, SlidersHorizontal, User, Users, Crop, Layers, Columns } from "../Icons";
import type { VerticalMode } from "@/lib/types";

interface StudioPacingSectionProps {
  verticalMode: VerticalMode;
  onVerticalModeChange: (mode: VerticalMode) => void;
  smartPunchInZoom: boolean;
  onSmartPunchInZoomChange: (val: boolean) => void;
  hookSensitivity: "extreme" | "balanced" | "subtle";
  onHookSensitivityChange: (val: "extreme" | "balanced" | "subtle") => void;
  cutPacing: "ultra_fast" | "dynamic" | "smooth";
  onCutPacingChange: (val: "ultra_fast" | "dynamic" | "smooth") => void;
  removeSilences: boolean;
  onRemoveSilencesChange: (val: boolean) => void;
  minSeconds: number;
  onMinSecondsChange: (val: number) => void;
  maxSeconds: number;
  onMaxSecondsChange: (val: number) => void;
  clipCount: number;
  onClipCountChange: (val: number) => void;
}

export default function StudioPacingSection({
  verticalMode,
  onVerticalModeChange,
  smartPunchInZoom,
  onSmartPunchInZoomChange,
  hookSensitivity,
  onHookSensitivityChange,
  cutPacing,
  onCutPacingChange,
  removeSilences,
  onRemoveSilencesChange,
  minSeconds,
  onMinSecondsChange,
  maxSeconds,
  onMaxSecondsChange,
  clipCount,
  onClipCountChange,
}: StudioPacingSectionProps) {
  return (
    <>
      {/* Bloco 2: Posição de Câmeras & Enquadramento Vertical */}
      <div className="control-box">
        <div className="control-box-header">
          <Video size={17} style={{ color: "var(--primary)" }} />
          <strong>Posição de Câmeras &amp; Enquadramento</strong>
        </div>

        <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
          <div>
            <label className="field-label">Enquadramento da Câmera</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: "0.45rem" }}>
              <div
                className={`selection-card ${verticalMode === "grupo" ? "active" : ""}`}
                onClick={() => onVerticalModeChange("grupo")}
                style={{
                  padding: "0.55rem 0.4rem",
                  border: verticalMode === "grupo" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: verticalMode === "grupo" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                  textAlign: "center",
                }}
              >
                <Users size={18} style={{ color: verticalMode === "grupo" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Grupo (IA)</strong>
                <small className="muted" style={{ fontSize: "0.68rem" }}>Foco em quem fala</small>
              </div>
              <div
                className={`selection-card ${verticalMode === "face_tracking" ? "active" : ""}`}
                onClick={() => onVerticalModeChange("face_tracking")}
                style={{
                  padding: "0.55rem 0.4rem",
                  border: verticalMode === "face_tracking" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: verticalMode === "face_tracking" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                  textAlign: "center",
                }}
              >
                <User size={18} style={{ color: verticalMode === "face_tracking" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Auto-Face (IA)</strong>
                <small className="muted" style={{ fontSize: "0.68rem" }}>Centraliza falante</small>
              </div>

              <div
                className={`selection-card ${verticalMode === "split_face" ? "active" : ""}`}
                onClick={() => onVerticalModeChange("split_face")}
                style={{
                  padding: "0.55rem 0.4rem",
                  border: verticalMode === "split_face" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: verticalMode === "split_face" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                  textAlign: "center",
                }}
              >
                <Users size={18} style={{ color: verticalMode === "split_face" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Podcast IA</strong>
                <small className="muted" style={{ fontSize: "0.68rem" }}>Host + Convidado</small>
              </div>

              <div
                className={`selection-card ${verticalMode === "crop" ? "active" : ""}`}
                onClick={() => onVerticalModeChange("crop")}
                style={{
                  padding: "0.55rem 0.4rem",
                  border: verticalMode === "crop" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: verticalMode === "crop" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                  textAlign: "center",
                }}
              >
                <Crop size={18} style={{ color: verticalMode === "crop" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Preencher 9:16</strong>
                <small className="muted" style={{ fontSize: "0.68rem" }}>Recorte central</small>
              </div>

              <div
                className={`selection-card ${verticalMode === "blur" ? "active" : ""}`}
                onClick={() => onVerticalModeChange("blur")}
                style={{
                  padding: "0.55rem 0.4rem",
                  border: verticalMode === "blur" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: verticalMode === "blur" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                  textAlign: "center",
                }}
              >
                <Layers size={18} style={{ color: verticalMode === "blur" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Fundo Blur</strong>
                <small className="muted" style={{ fontSize: "0.68rem" }}>Com desfoque</small>
              </div>

              <div
                className={`selection-card ${verticalMode === "split" ? "active" : ""}`}
                onClick={() => onVerticalModeChange("split")}
                style={{
                  padding: "0.55rem 0.4rem",
                  border: verticalMode === "split" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: verticalMode === "split" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                  textAlign: "center",
                }}
              >
                <Columns size={18} style={{ color: verticalMode === "split" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Split 50/50</strong>
                <small className="muted" style={{ fontSize: "0.68rem" }}>Divisão fixa</small>
              </div>
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={smartPunchInZoom}
              onChange={(e) => onSmartPunchInZoomChange(e.target.checked)}
            />
            <span>Punch-in Zoom dinâmico em falas de impacto/clímax</span>
          </label>
        </div>
      </div>

      {/* Bloco 3: Momentos Importantes & Dinâmica de Corte */}
      <div className="control-box">
        <div className="control-box-header">
          <SlidersHorizontal size={17} style={{ color: "var(--primary)" }} />
          <strong>Momentos Importantes &amp; Ritmo</strong>
        </div>

        <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
          <div>
            <label className="field-label">Sensibilidade de Ganchos (Hooks)</label>
            <select
              className="input select"
              value={hookSensitivity}
              onChange={(e) => onHookSensitivityChange(e.target.value as any)}
            >
              <option value="extreme">Prioridade Máxima (Momentos de Alto Impacto)</option>
              <option value="balanced">Equilibrada (Retenção &amp; Contexto)</option>
              <option value="subtle">Narrativa Suave (Fluidez Contínua)</option>
            </select>
          </div>

          <div>
            <label className="field-label">Ritmo de Cortes na Edição</label>
            <select
              className="input select"
              value={cutPacing}
              onChange={(e) => onCutPacingChange(e.target.value as any)}
            >
              <option value="ultra_fast">Ultra Dinâmico (1 a 3 segundos)</option>
              <option value="dynamic">Dinâmico Social (3 a 5 segundos)</option>
              <option value="smooth">Fluido / Conversação (5 a 8s)</option>
            </select>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={removeSilences}
              onChange={(e) => onRemoveSilencesChange(e.target.checked)}
            />
            <span>Remover silêncios e pausas longas automaticamente</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={smartPunchInZoom}
              onChange={(e) => onSmartPunchInZoomChange(e.target.checked)}
            />
            <span>Punch-in Zoom inteligente em palavras de clímax</span>
          </label>

          <div className="row" style={{ gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Duração Mín. (s)</label>
              <input
                type="number"
                className="input"
                value={minSeconds}
                min={10}
                max={180}
                onChange={(e) => onMinSecondsChange(Number(e.target.value))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Duração Máx. (s)</label>
              <input
                type="number"
                className="input"
                value={maxSeconds}
                min={20}
                max={300}
                onChange={(e) => onMaxSecondsChange(Number(e.target.value))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Cortes</label>
              <input
                type="number"
                className="input"
                value={clipCount}
                min={1}
                max={20}
                onChange={(e) => onClipCountChange(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
