"use client";

import React from "react";
import Link from "next/link";
import { Scissors, Copy, Wand2, SlidersHorizontal, Film, ArrowRight, FolderKanban, FolderPlus } from "./Icons";

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
              Rápido &amp; Automático
            </span>
          </div>

          <div className="mode-card-body">
            <h3 className="mode-card-title">Cortes AI</h3>
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

        {/* CARD 3: MEUS PROJETOS */}
        <Link
          href="/projetos"
          className="mode-card"
          style={{ textDecoration: "none" }}
        >
          <div className="mode-card-top">
            <div className="mode-card-icon-wrap projects">
              <FolderKanban size={26} />
            </div>
            <span
              className="mode-card-badge"
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10B981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              <FolderPlus size={12} style={{ marginRight: "3px" }} />
              CapCut Workspace
            </span>
          </div>

          <div className="mode-card-body">
            <h3 className="mode-card-title">Meus Projetos</h3>
            <p className="mode-card-desc">
              Organize seus cortes em pastas dedicadas, acesse seus workspaces salvos e gerencie sua linha do tempo com facilidade.
            </p>
          </div>

          <div className="mode-card-footer">
            <div className="mode-card-tags">
              <span>Pastas</span>
              <span>Linha do Tempo</span>
              <span>Workspace</span>
            </div>
            <div className="mode-card-action">
              <span>Acessar Projetos</span>
              <ArrowRight size={16} />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
