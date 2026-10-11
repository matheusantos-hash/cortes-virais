"use client";

import React from "react";
import { Volume2, FileCode } from "../Icons";

interface StudioExportSectionProps {
  resolution: "1080x1920" | "1920x1080" | "1080x1080" | "2160x3840";
  onResolutionChange: (val: "1080x1920" | "1920x1080" | "1080x1080" | "2160x3840") => void;
  codec: "h264" | "hevc" | "prores422";
  onCodecChange: (val: "h264" | "hevc" | "prores422") => void;
  fps: 24 | 30 | 60;
  onFpsChange: (val: 24 | 30 | 60) => void;
  bitrate: "master" | "high" | "standard";
  onBitrateChange: (val: "master" | "high" | "standard") => void;
  audioNormalization: boolean;
  onAudioNormalizationChange: (val: boolean) => void;
  generateNleTimeline: boolean;
  onGenerateNleTimelineChange: (val: boolean) => void;
}

export default function StudioExportSection({
  resolution,
  onResolutionChange,
  codec,
  onCodecChange,
  fps,
  onFpsChange,
  bitrate,
  onBitrateChange,
  audioNormalization,
  onAudioNormalizationChange,
  generateNleTimeline,
  onGenerateNleTimelineChange,
}: StudioExportSectionProps) {
  return (
    <section className="studio-section">
      <div className="studio-section-title">
        <span className="step-number">4</span>
        <div>
          <h3>Opções de Exportação Profissional</h3>
          <p className="muted small">Configurações de renderização, codecs e exportação para NLEs (Premiere / DaVinci)</p>
        </div>
      </div>

      <div className="card-subtle stack" style={{ padding: "1.2rem" }}>
        <div className="export-grid">
          <div>
            <label className="field-label">Resolução de Saída</label>
            <select
              className="input select"
              value={resolution}
              onChange={(e) => onResolutionChange(e.target.value as any)}
            >
              <option value="1080x1920">1080x1920 (Vertical 9:16 - TikTok / Reels / Shorts)</option>
              <option value="2160x3840">2160x3840 (4K Vertical Ultra HD)</option>
              <option value="1920x1080">1920x1080 (Horizontal 16:9 - YouTube Padrão)</option>
              <option value="1080x1080">1080x1080 (Quadrado 1:1 - Feed Instagram)</option>
            </select>
          </div>

          <div>
            <label className="field-label">Codec de Vídeo</label>
            <select
              className="input select"
              value={codec}
              onChange={(e) => onCodecChange(e.target.value as any)}
            >
              <option value="h264">H.264 / AVC (Máxima compatibilidade)</option>
              <option value="hevc">H.265 / HEVC (Maior nitidez e menor tamanho)</option>
              <option value="prores422">Apple ProRes 422 (Master sem perdas)</option>
            </select>
          </div>

          <div>
            <label className="field-label">Taxa de Quadros (FPS)</label>
            <select
              className="input select"
              value={fps}
              onChange={(e) => onFpsChange(Number(e.target.value) as any)}
            >
              <option value={60}>60 FPS (Ultra Suave)</option>
              <option value={30}>30 FPS (Padrão Redes Sociais)</option>
              <option value={24}>24 FPS (Cinemático)</option>
            </select>
          </div>

          <div>
            <label className="field-label">Bitrate de Renderização</label>
            <select
              className="input select"
              value={bitrate}
              onChange={(e) => onBitrateChange(e.target.value as any)}
            >
              <option value="master">Master Studio (25 Mbps)</option>
              <option value="high">Alta Qualidade (12 Mbps)</option>
              <option value="standard">Web Otimizado (6 Mbps)</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: "0.85rem", gap: "1.5rem", flexWrap: "wrap" }}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={audioNormalization}
              onChange={(e) => onAudioNormalizationChange(e.target.checked)}
            />
            <span title="Ajusta o volume do áudio para o padrão exigido pelo TikTok, Reels e Shorts">
              <Volume2 size={15} style={{ verticalAlign: "middle", marginRight: "4px" }} />
              Normalização de Áudio EBU R128 (-14 LUFS para Redes Sociais)
            </span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={generateNleTimeline}
              onChange={(e) => onGenerateNleTimelineChange(e.target.checked)}
            />
            <span title="Gera arquivos XML e EDL para abrir a timeline no Premiere Pro ou DaVinci Resolve">
              <FileCode size={15} style={{ verticalAlign: "middle", marginRight: "4px" }} />
              Gerar Pacote NLE (XML Premiere + EDL DaVinci + SRT)
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
