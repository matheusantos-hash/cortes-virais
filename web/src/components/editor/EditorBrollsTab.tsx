"use client";

import React from "react";
import { Lightbulb, Info, Trash2 } from "../Icons";
import type { CanvasBroll, CanvasBrollTemplate } from "@/lib/types";
import type { BrollTriggerSuggestion } from "@/lib/detectBrollTriggers";

interface EditorBrollsTabProps {
  currentTime: number;
  canvasBrolls: CanvasBroll[];
  selectedBrollId: string | null;
  suggestions: BrollTriggerSuggestion[];
  onSelectBroll: (id: string, offsetSec: number) => void;
  onRemoveBroll: (id: string) => void;
  onAddBrollAtCurrentTime: (template: CanvasBrollTemplate) => void;
  onAddFromSuggestion: (s: BrollTriggerSuggestion) => void;
  onPreviewSuggestion: (s: BrollTriggerSuggestion) => void;
}

export default function EditorBrollsTab({
  currentTime,
  canvasBrolls,
  selectedBrollId,
  suggestions,
  onSelectBroll,
  onRemoveBroll,
  onAddBrollAtCurrentTime,
  onAddFromSuggestion,
  onPreviewSuggestion,
}: EditorBrollsTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {/* 1. SUGESTÕES DA IA NO TOPO */}
      {suggestions.length > 0 && (
        <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-400/30 shadow-sm">
          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
            <Lightbulb size={14} className="text-amber-400" />
            Sugestões Identificadas pela IA ({suggestions.length}):
          </span>
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {suggestions.map((s, idx) => {
              const isAdded = canvasBrolls.some((b) => Math.abs(b.offsetSec - s.offsetSec) < 0.5);
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    background: "#0E1017",
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border: "1px solid #212634",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.74rem" }}>
                    <strong style={{ color: "#22D3EE", fontFamily: "monospace", marginRight: "4px" }}>{s.offsetSec}s</strong>
                    <span style={{ color: "#E2E8F0" }} title={s.suggestedTitle}>{s.suggestedTitle}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                    {/* Botão "i" para abrir modal com detalhes e prévia animada */}
                    <button
                      type="button"
                      onClick={() => onPreviewSuggestion(s)}
                      title="Ver explicação e prévia deste elemento"
                      style={{
                        padding: 0,
                        width: "22px",
                        height: "22px",
                        minWidth: "22px",
                        minHeight: "22px",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.16)",
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "#38BDF8",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                      className="hover:border-cyan-400 hover:bg-cyan-500/20 active:scale-95"
                    >
                      <Info size={12} />
                    </button>

                    {/* Botão compacto Add */}
                    <button
                      type="button"
                      disabled={isAdded}
                      onClick={() => onAddFromSuggestion(s)}
                      title={isAdded ? "Elemento já adicionado à timeline" : "Adicionar elemento à timeline"}
                      style={{
                        padding: "0 8px",
                        height: "22px",
                        minHeight: "22px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        borderRadius: "6px",
                        border: "none",
                        cursor: isAdded ? "default" : "pointer",
                        background: isAdded ? "#1E293B" : "var(--primary, #4F46E5)",
                        color: isAdded ? "#64748B" : "#FFFFFF",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                      className={isAdded ? "" : "hover:brightness-110 active:scale-95"}
                    >
                      {isAdded ? "Ativo" : "+ Add"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. INSERIR MANUALMENTE NO PLAYHEAD */}
      <div>
        <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.88rem", color: "#FFF", fontWeight: 700 }}>
          Inserir Motion no Playhead
        </h4>
        <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
          Adicione animações de retenção no segundo exato ({currentTime.toFixed(1)}s):
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
        <button
          type="button"
          onClick={() => onAddBrollAtCurrentTime("metric_counter")}
          style={{
            padding: "0.5rem 0.4rem",
            borderRadius: "6px",
            background: "#1A1D27",
            border: "1px solid #2B3042",
            color: "#00F0FF",
            cursor: "pointer",
            fontSize: "0.74rem",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          + Contador (+300%)
        </button>

        <button
          type="button"
          onClick={() => onAddBrollAtCurrentTime("growth_chart")}
          style={{
            padding: "0.5rem 0.4rem",
            borderRadius: "6px",
            background: "#1A1D27",
            border: "1px solid #2B3042",
            color: "#10B981",
            cursor: "pointer",
            fontSize: "0.74rem",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          + Gráfico de Alta
        </button>

        <button
          type="button"
          onClick={() => onAddBrollAtCurrentTime("glass_alert")}
          style={{
            padding: "0.5rem 0.4rem",
            borderRadius: "6px",
            background: "#1A1D27",
            border: "1px solid #2B3042",
            color: "#F59E0B",
            cursor: "pointer",
            fontSize: "0.74rem",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          + Alerta Glass
        </button>

        <button
          type="button"
          onClick={() => onAddBrollAtCurrentTime("viral_tag")}
          style={{
            padding: "0.5rem 0.4rem",
            borderRadius: "6px",
            background: "#1A1D27",
            border: "1px solid #2B3042",
            color: "#C084FC",
            cursor: "pointer",
            fontSize: "0.74rem",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          + Tag Viral
        </button>
      </div>

      {/* Lista de B-Rolls Adicionados */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8" }}>
            Camadas na Timeline ({canvasBrolls.length}):
          </span>
        </div>

        {canvasBrolls.length === 0 ? (
          <div
            style={{
              padding: "1rem",
              textAlign: "center",
              background: "#161924",
              borderRadius: "8px",
              border: "1px dashed #2A3042",
              color: "#64748B",
              fontSize: "0.75rem",
            }}
          >
            Nenhum B-Roll adicionado ainda.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "200px", overflowY: "auto" }}>
            {canvasBrolls.map((b) => {
              const isSelected = b.id === selectedBrollId;
              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBroll(b.id, b.offsetSec)}
                  style={{
                    background: isSelected ? "rgba(0, 240, 255, 0.12)" : "#171A25",
                    border: `1px solid ${isSelected ? "#00F0FF" : "#262B3B"}`,
                    borderRadius: "6px",
                    padding: "0.5rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span style={{ background: "#00F0FF", color: "#000", fontSize: "0.65rem", padding: "0.08rem 0.3rem", borderRadius: "3px", fontWeight: 800 }}>
                        {b.offsetSec.toFixed(1)}s
                      </span>
                      <strong style={{ fontSize: "0.78rem", color: "#FFF" }}>{b.data.title || "B-Roll"}</strong>
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>Duração: {b.durationSec}s</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBroll(b.id);
                    }}
                    style={{
                      background: "rgba(239, 68, 68, 0.2)",
                      color: "#EF4444",
                      border: "none",
                      borderRadius: "4px",
                      padding: "0.25rem 0.35rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Remover B-Roll"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
