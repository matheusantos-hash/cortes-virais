"use client";

import React from "react";
import { Scissors, Copy, Sparkles, Wand2, SlidersHorizontal, Film, ArrowRight } from "./Icons";

export type DashboardMode = "cortes" | "copiar_estilo";

interface ModeSelectorCardsProps {
  currentMode: DashboardMode;
  onSelectMode: (mode: DashboardMode) => void;
}

export default function ModeSelectorCards({ currentMode, onSelectMode }: ModeSelectorCardsProps) {
  return (
    <div className="mode-selector-container">
      <div className="mode-selector-header">
        <div>
          <span className="mode-selector-eyebrow">
            <Sparkles size={14} style={{ color: "var(--primary)" }} />
            ESCOLHA SEU FLUXO DE CRIAÇÃO
          </span>
          <h2 style={{ fontSize: "1.35rem", margin: "0.2rem 0 0" }}>O que você deseja criar hoje?</h2>
        </div>
      </div>

      <div className="mode-selector-grid">
        {/* CARD 1: CORTES VIRAIS */}
        <button
          type="button"
          className={`mode-card ${currentMode === "cortes" ? "active" : ""}`}
          onClick={() => onSelectMode("cortes")}
        >
          <div className="mode-card-top">
            <div className="mode-card-icon-wrap cortes">
              <Scissors size={26} />
            </div>
            <span className="mode-card-badge cortes-badge">
              ⚡ Rápido &amp; Automático
            </span>
          </div>

          <div className="mode-card-body">
            <h3 className="mode-card-title">Cortes Virais com IA</h3>
            <p className="mode-card-desc">
              Envie um vídeo longo ou link do YouTube. A inteligência artificial garimpa os melhores momentos,
              detecta ganchos hipnóticos e gera clipes prontos para TikTok, Reels e Shorts.
            </p>
          </div>

          <div className="mode-card-footer">
            <div className="mode-card-tags">
              <span>Auto-Face IA</span>
              <span>Podcast Split</span>
              <span>Ganchos Virais</span>
            </div>
            <div className="mode-card-action">
              <span>{currentMode === "cortes" ? "Modo Selecionado" : "Selecionar Cortes"}</span>
              <ArrowRight size={16} />
            </div>
          </div>
        </button>

        {/* CARD 2: COPIAR ESTILO DE EDIÇÃO */}
        <button
          type="button"
          className={`mode-card pro ${currentMode === "copiar_estilo" ? "active" : ""}`}
          onClick={() => onSelectMode("copiar_estilo")}
        >
          <div className="mode-card-top">
            <div className="mode-card-icon-wrap style">
              <Copy size={26} />
            </div>
            <span className="mode-card-badge pro-badge">
              <Wand2 size={12} style={{ marginRight: "3px" }} />
              Novo • Clone Studio
            </span>
          </div>

          <div className="mode-card-body">
            <h3 className="mode-card-title">Copiar Estilo de Edição</h3>
            <p className="mode-card-desc">
              Envie um vídeo de referência para clonar o ritmo de cortes, estilo de legendas e estética.
              Salve referências para reutilizar, faça ajustes manuais e exporte com qualidade profissional.
            </p>
          </div>

          <div className="mode-card-footer">
            <div className="mode-card-tags">
              <span>Vídeo de Referência</span>
              <span>Ajustes Manuais</span>
              <span>Exportação Pro (NLE)</span>
            </div>
            <div className="mode-card-action">
              <span>{currentMode === "copiar_estilo" ? "Modo Selecionado" : "Entrar no Studio"}</span>
              <ArrowRight size={16} />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
