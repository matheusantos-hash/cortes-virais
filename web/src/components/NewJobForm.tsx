"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadResumable } from "@/lib/upload";
import { VerticalMode } from "@/lib/types";
import {
  LinkIcon,
  UploadIcon,
  SmartphoneIcon,
  MonitorIcon,
  CropIcon,
  LayersIcon,
  ColumnsIcon,
  UserIcon,
  UsersIcon,
  SparklesIcon,
  SlidersIcon,
  XIcon,
  VideoIcon,
  TrendingUpIcon,
  CrownIcon,
  CoinsIcon,
} from "./Icons";

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;
const RESUMABLE_FROM_BYTES = 6 * 1024 * 1024; // acima disso, usa envio retomável (TUS)

function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const STYLE_PRESETS = [
  { id: "ganchos_rapidos", name: "Ganchos Rápidos (TikTok/Reels)", desc: "Cortes dinâmicos com abertura impactante e ritmo acelerado" },
  { id: "podcast", name: "🎙️ Podcast & Entrevistas", desc: "Focado em perguntas instigantes, respostas marcantes e diálogos" },
  { id: "storytelling", name: "💡 Storytelling & Reflexão", desc: "Histórias envolventes com começo, meio e desfecho emocionante" },
  { id: "educacional", name: "🧠 Educacional & Dicas Práticas", desc: "Explicações diretas ao ponto com alto valor informativo" },
  { id: "humor", name: "🎭 Humor & Momentos Cômicos", desc: "Piadas, reações engraçadas e momentos descontraídos" },
];

export default function NewJobForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [credits, setCredits] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchCredits = useCallback(() => {
    const supabase = createClient();
    supabase
      .from("usuarios")
      .select("creditos_minutos, is_xandao")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCredits(Number(data.creditos_minutos ?? 30));
          setIsAdmin(Boolean(data.is_xandao));
        }
      });
  }, [userId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const [mode, setMode] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [verticalMode, setVerticalMode] = useState<VerticalMode>("crop");
  const [cropPct, setCropPct] = useState(50);
  const [clipCount, setClipCount] = useState(5);
  const [minSeconds, setMinSeconds] = useState(30);
  const [maxSeconds, setMaxSeconds] = useState(90);
  const [language, setLanguage] = useState("pt-BR");
  const [dryRun, setDryRun] = useState(false);

  // Opções de "Copiar Estilo" (Vídeo de Referência + Higgsfield AI)
  const [copyStyle, setCopyStyle] = useState(false);
  const [refMode, setRefMode] = useState<"upload" | "link">("upload");
  const [refUrl, setRefUrl] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refStyle, setRefStyle] = useState(STYLE_PRESETS[0].name);
  const [designInstructions, setDesignInstructions] = useState("");

  // Opções de B-Roll
  const [useBroll, setUseBroll] = useState(false);
  const [brollSource, setBrollSource] = useState<"pexels" | "higgsfield">("higgsfield");

  // Opções de Legendas & Sound Design (Fase 4 & HyperFrames)
  const [subtitleStyle, setSubtitleStyle] = useState<"hormozi" | "apple" | "beast" | "minimal">("hormozi");
  const [enableEmojis, setEnableEmojis] = useState(true);
  const [enableSfx, setEnableSfx] = useState(true);

  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("video/") || /\.(mp4|mov|mkv|avi|webm)$/i.test(droppedFile.name)) {
        setFile(droppedFile);
      } else {
        setError("Por favor, selecione um arquivo de vídeo válido (.mp4, .mov, .mkv).");
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (minSeconds < 5 || minSeconds >= maxSeconds) {
      return setError("A duração mínima deve ser de pelo menos 5 s e a mínima menor que a máxima.");
    }
    if (clipCount < 1 || clipCount > 20) {
      return setError("A quantidade de cortes deve ficar entre 1 e 20.");
    }
    if (!isAdmin && credits !== null && credits <= 0) {
      return setError("Seu saldo de minutos esgotou (0.0 min). Solicite uma recarga ao administrador para continuar.");
    }

    const supabase = createClient();
    let source: Record<string, string>;

    setBusy(true);
    if (mode === "link") {
      let parsed: URL;
      try {
        parsed = new URL(url.trim());
        if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      } catch {
        setBusy(false);
        return setError("Cole um link válido, começando com http:// ou https://");
      }
      if (/(^|\.)(drive|docs)\.google\.com$/.test(parsed.hostname)) {
        setBusy(false);
        return setError("Links do Google Drive ainda não são suportados. Use um link do YouTube ou envie o arquivo.");
      }
      source = { source_type: "link", source_url: parsed.toString() };
    } else {
      if (!file) {
        setBusy(false);
        return setError("Selecione ou arraste um arquivo de vídeo principal.");
      }
      if (!file.type.startsWith("video/") && !/\.(mp4|mov|mkv|avi|webm)$/i.test(file.name)) {
        setBusy(false);
        return setError("O arquivo principal precisa ser um vídeo (.mp4, .mov, .mkv).");
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setBusy(false);
        return setError(`O arquivo tem mais de ${MAX_UPLOAD_MB} MB. Cole um link do YouTube no lugar.`);
      }
      const path = `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      let upError: string | null = null;
      try {
        if (file.size > RESUMABLE_FROM_BYTES) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) throw new Error("Sessão expirada. Entre novamente.");
          setUploadPct(0);
          await uploadResumable({
            accessToken: session.access_token,
            bucket: "sources",
            path,
            file,
            onProgress: setUploadPct,
          });
        } else {
          const { error } = await supabase.storage.from("sources").upload(path, file, { contentType: file.type || "video/mp4" });
          if (error) throw new Error(error.message);
        }
      } catch (err) {
        upError = err instanceof Error ? err.message : "erro desconhecido";
      }
      setUploadPct(null);
      if (upError) {
        setBusy(false);
        return setError(`Falha ao enviar o arquivo de vídeo: ${upError}`);
      }
      source = { source_type: "upload", source_path: path };
    }

    // Processamento de Copiar Estilo / Vídeo de Referência (se ativado)
    let refPath: string | null = null;
    if (copyStyle && refMode === "upload" && refFile) {
      const refStoragePath = `${userId}/ref-${crypto.randomUUID()}-${safeName(refFile.name)}`;
      try {
        const { error: refUpError } = await supabase.storage.from("sources").upload(refStoragePath, refFile, {
          contentType: refFile.type || "video/mp4",
        });
        if (refUpError) throw new Error(refUpError.message);
        refPath = refStoragePath;
      } catch (err) {
        setBusy(false);
        return setError(`Falha ao enviar vídeo de referência: ${err instanceof Error ? err.message : "erro desconhecido"}`);
      }
    }

    const payload: Record<string, any> = {
      ...source,
      file_name: mode === "upload" && file ? file.name : null,
      orientation,
      vertical_mode: orientation === "vertical" ? verticalMode : "crop",
      crop_x: cropPct / 100,
      clip_count: clipCount,
      min_seconds: minSeconds,
      max_seconds: maxSeconds,
      language,
      reference_type: copyStyle ? refMode : "none",
      reference_url: copyStyle && refMode === "link" && refUrl.trim() ? refUrl.trim() : null,
      reference_path: refPath,
      reference_style: copyStyle ? refStyle : null,
      design_instructions: copyStyle && designInstructions.trim() ? designInstructions.trim() : null,
      use_broll: useBroll,
      broll_source: useBroll ? brollSource : "none",
      subtitle_style: subtitleStyle,
      enable_sfx: enableSfx,
      enable_emojis: enableEmojis,
    };

    let { error: insError } = await supabase.from("jobs").insert(payload);

    // Se o banco ainda não tiver as novas colunas de legendas/sfx, tenta novamente sem elas
    if (insError && (insError.message.includes("subtitle_style") || insError.message.includes("enable_sfx") || insError.message.includes("enable_emojis"))) {
      delete payload.subtitle_style;
      delete payload.enable_sfx;
      delete payload.enable_emojis;
      const retry = await supabase.from("jobs").insert(payload);
      insError = retry.error;
    }

    // Se o banco ainda não tiver as colunas de B-Roll, tenta novamente sem elas
    if (insError && (insError.message.includes("broll_source") || insError.message.includes("use_broll"))) {
      delete payload.use_broll;
      delete payload.broll_source;
      const retry = await supabase.from("jobs").insert(payload);
      insError = retry.error;
    }

    // Se o banco ainda não tiver as colunas de Referência/Design, tenta novamente sem elas
    if (insError && (insError.message.includes("reference_") || insError.message.includes("design_instructions") || insError.message.includes("vertical_mode"))) {
      delete payload.reference_type;
      delete payload.reference_url;
      delete payload.reference_path;
      delete payload.reference_style;
      delete payload.design_instructions;
      delete payload.vertical_mode;
      const retry = await supabase.from("jobs").insert(payload);
      insError = retry.error;
    }

    // Se o banco ainda não tiver a coluna file_name ou source_meta
    if (insError && (insError.message.includes("file_name") || insError.message.includes("source_meta"))) {
      delete payload.file_name;
      delete payload.source_meta;
      const retry = await supabase.from("jobs").insert(payload);
      insError = retry.error;
    }

    setBusy(false);
    if (insError) return setError(`Não foi possível criar o pedido: ${insError.message}`);

    setUrl("");
    setFile(null);
    setCopyStyle(false);
    setRefUrl("");
    setRefFile(null);
    setDesignInstructions("");
    onCreated();
    fetchCredits();
  }

  const hasNoCredits = !isAdmin && credits !== null && credits <= 0;

  return (
    <form onSubmit={submit} className="card stack">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
          <h2>Criar Cortes com IA</h2>
          <span className="badge badge-queued" style={{ fontSize: "0.72rem" }}>Claude Sonnet + FFmpeg</span>
        </div>
        <div>
          {isAdmin ? (
            <span
              className="badge"
              style={{
                background: "rgba(124, 58, 237, 0.2)",
                color: "#c084fc",
                border: "1px solid rgba(168, 85, 247, 0.4)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
              title="Conta com acesso irrestrito"
            >
              <CrownIcon size={13} style={{ color: "#c084fc" }} /> VIP Ilimitado
            </span>
          ) : credits !== null ? (
            <span
              className="badge"
              style={{
                background: credits > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: credits > 0 ? "#10b981" : "#ef4444",
                border: `1px solid ${credits > 0 ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                fontWeight: 600,
                fontSize: "0.82rem",
              }}
              title="Saldo disponível de minutos de vídeo para processar"
            >
              🪙 Saldo: {credits.toFixed(1)} min
            </span>
          ) : null}
        </div>
      </div>

      {/* Abas de Origem (Tabs) */}
      <div className="segmented-control" role="tablist">
        <button
          type="button"
          className={`segmented-btn ${mode === "link" ? "active" : ""}`}
          onClick={() => { setMode("link"); setError(null); }}
        >
          <LinkIcon size={16} />
          <span>Link de Vídeo</span>
        </button>
        <button
          type="button"
          className={`segmented-btn ${mode === "upload" ? "active" : ""}`}
          onClick={() => { setMode("upload"); setError(null); }}
        >
          <UploadIcon size={16} />
          <span>Enviar Arquivo</span>
        </button>
      </div>

      {mode === "link" ? (
        <label>
          URL do Vídeo (YouTube / Vimeo / Web)
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=… ou Vimeo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <small>Cole o link de podcasts, palestras ou entrevistas para cortar trechos virais.</small>
        </label>
      ) : (
        <div>
          <label style={{ marginBottom: "0.4rem" }}>Arquivo de Vídeo (.mp4, .mov, .mkv)</label>
          <div
            className={`dropzone ${dragOver ? "active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.mkv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
            <div className="dropzone-icon">
              <UploadIcon size={22} />
            </div>
            {file ? (
              <div>
                <strong style={{ color: "var(--text)", display: "block" }}>{file.name}</strong>
                <span className="muted small">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  className="btn-danger-outline"
                  style={{ marginTop: "0.5rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <XIcon size={14} /> Remover arquivo
                </button>
              </div>
            ) : (
              <div>
                <strong className="dropzone-title">
                  Arraste e solte o vídeo aqui
                </strong>
                <span className="dropzone-subtitle" style={{ display: "block" }}>ou clique para selecionar do computador (até {MAX_UPLOAD_MB} MB)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seletor Visual de Formato (Cards Clicáveis) */}
      <div>
        <label style={{ marginBottom: "0.4rem" }}>Formato de Saída:</label>
        <div className="selection-grid">
          <div
            className={`selection-card ${orientation === "vertical" ? "active" : ""}`}
            onClick={() => setOrientation("vertical")}
          >
            <SmartphoneIcon size={24} style={{ color: orientation === "vertical" ? "var(--primary)" : "var(--text-muted)" }} />
            <div className="selection-card-title">Vertical (9:16)</div>
            <span className="selection-card-desc">Otimizado para TikTok, Reels e YouTube Shorts.</span>
          </div>

          <div
            className={`selection-card ${orientation === "horizontal" ? "active" : ""}`}
            onClick={() => setOrientation("horizontal")}
          >
            <MonitorIcon size={24} style={{ color: orientation === "horizontal" ? "var(--primary)" : "var(--text-muted)" }} />
            <div className="selection-card-title">Horizontal (16:9)</div>
            <span className="selection-card-desc">Widescreen para YouTube tradicional e sites.</span>
          </div>
        </div>
      </div>

      {/* Opções de Enquadramento Vertical (somente se 9:16 estiver ativo) */}
      {orientation === "vertical" && (
        <div className="card" style={{ background: "var(--bg-subtle)", padding: "1rem" }}>
          <label style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Enquadramento da Câmera Vertical:</span>
            {(verticalMode === "face_tracking" || verticalMode === "split_face") && (
              <span className="badge badge-done" style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}>
                <SparklesIcon size={12} /> Detecção Facial com IA
              </span>
            )}
          </label>

          <div className="selection-grid-framing">
            <div
              className={`selection-card ${verticalMode === "face_tracking" ? "active" : ""}`}
              onClick={() => setVerticalMode("face_tracking")}
            >
              <UserIcon size={20} style={{ color: verticalMode === "face_tracking" ? "var(--primary)" : "var(--text-muted)" }} />
              <strong className="selection-card-title">Auto-Face (IA)</strong>
              <small className="selection-card-desc">Centraliza o rosto</small>
            </div>

            <div
              className={`selection-card ${verticalMode === "split_face" ? "active" : ""}`}
              onClick={() => setVerticalMode("split_face")}
            >
              <UsersIcon size={20} style={{ color: verticalMode === "split_face" ? "var(--primary)" : "var(--text-muted)" }} />
              <strong className="selection-card-title">Podcast IA</strong>
              <small className="selection-card-desc">Host + Convidado</small>
            </div>

            <div
              className={`selection-card ${verticalMode === "crop" ? "active" : ""}`}
              onClick={() => setVerticalMode("crop")}
            >
              <CropIcon size={20} style={{ color: verticalMode === "crop" ? "var(--primary)" : "var(--text-muted)" }} />
              <strong className="selection-card-title">Preencher</strong>
              <small className="selection-card-desc">Corte manual/fixo</small>
            </div>

            <div
              className={`selection-card ${verticalMode === "blur" ? "active" : ""}`}
              onClick={() => setVerticalMode("blur")}
            >
              <LayersIcon size={20} style={{ color: verticalMode === "blur" ? "var(--primary)" : "var(--text-muted)" }} />
              <strong className="selection-card-title">Fundo Blur</strong>
              <small className="selection-card-desc">Vídeo + desfoque</small>
            </div>

            <div
              className={`selection-card ${verticalMode === "split" ? "active" : ""}`}
              onClick={() => setVerticalMode("split")}
            >
              <ColumnsIcon size={20} style={{ color: verticalMode === "split" ? "var(--primary)" : "var(--text-muted)" }} />
              <strong className="selection-card-title">Split 50/50</strong>
              <small className="selection-card-desc">Divisão fixa</small>
            </div>
          </div>

          {verticalMode === "face_tracking" && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <SparklesIcon size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
              <span>A IA analisa os frames do vídeo para detectar e centralizar automaticamente a pessoa que está em foco.</span>
            </div>
          )}

          {verticalMode === "split_face" && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <UsersIcon size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
              <span>Ideal para Podcasts com 2 participantes: a IA detecta os rostos dos dois lados e enquadra o Host no topo e o Convidado na base.</span>
            </div>
          )}

          {verticalMode === "crop" && (
            <div style={{ marginTop: "0.75rem" }}>
              <label>
                Posição do corte: {cropPct}% ({cropPct < 40 ? "Esquerda" : cropPct > 60 ? "Direita" : "Centro"})
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={cropPct}
                  onChange={(e) => setCropPct(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Controles de Ajuste Numérico */}
      <div className="grid3">
        <label>
          Qtd. de cortes
          <input
            type="number"
            min={1}
            max={20}
            value={clipCount}
            onChange={(e) => setClipCount(Number(e.target.value))}
          />
        </label>
        <label>
          Duração Mín. (s)
          <input
            type="number"
            min={5}
            max={3600}
            value={minSeconds}
            onChange={(e) => setMinSeconds(Number(e.target.value))}
          />
          {minSeconds >= 60 && (
            <small className="muted">{Math.floor(minSeconds / 60)}m {minSeconds % 60 ? `${minSeconds % 60}s` : ""}</small>
          )}
        </label>
        <label>
          Duração Máx. (s)
          <input
            type="number"
            min={10}
            max={3600}
            value={maxSeconds}
            onChange={(e) => setMaxSeconds(Number(e.target.value))}
          />
          {maxSeconds >= 60 && (
            <small className="muted">{Math.floor(maxSeconds / 60)}m {maxSeconds % 60 ? `${maxSeconds % 60}s` : ""}</small>
          )}
        </label>
      </div>

      <label>
        Idioma Falado no Vídeo
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en">Inglês</option>
          <option value="es">Espanhol</option>
        </select>
      </label>

      {/* SEÇÃO PRINCIPAL: COPIAR ESTILO COM HIGGSFIELD AI */}
      <div
        className="card"
        style={{
          border: copyStyle ? "1px solid var(--primary)" : "1px dashed rgba(99, 102, 241, 0.4)",
          background: copyStyle ? "rgba(99, 102, 241, 0.06)" : "rgba(99, 102, 241, 0.02)",
          padding: "1rem",
          transition: "all 0.2s ease",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "0.75rem",
            cursor: "pointer",
            margin: 0,
          }}
        >
          <input
            type="checkbox"
            style={{ width: "1.25rem", height: "1.25rem", accentColor: "var(--primary)", marginTop: "0.2rem", cursor: "pointer" }}
            checked={copyStyle}
            onChange={(e) => {
              const val = e.target.checked;
              setCopyStyle(val);
              if (val) {
                setUseBroll(true);
                setBrollSource("higgsfield");
              }
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "1rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>✨</span> Copiar Estilo de Edição
              </strong>
              <span className="badge badge-done" style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}>
                <SparklesIcon size={12} /> Higgsfield AI + Claude Vision
              </span>
            </div>
            <small style={{ display: "block", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Envie ou cole o link de um vídeo modelo (TikTok/Reels/Shorts). A IA clona o ritmo de cortes, aplica jump zooms dinâmicos, legendas animadas palavra por palavra e gera B-Rolls cinematográficos combinando com a estética.
            </small>
          </div>
        </label>

        {copyStyle && (
          <div className="stack" style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--card-border)" }}>
            <label>
              Origem do Vídeo Modelo de Referência:
              <div className="tabs" style={{ marginTop: "0.35rem" }}>
                <button
                  type="button"
                  className={refMode === "upload" ? "tab active" : "tab"}
                  onClick={() => setRefMode("upload")}
                >
                  <UploadIcon size={14} style={{ marginRight: "0.35rem" }} /> Enviar Arquivo de Vídeo
                </button>
                <button
                  type="button"
                  className={refMode === "link" ? "tab active" : "tab"}
                  onClick={() => setRefMode("link")}
                >
                  <LinkIcon size={14} style={{ marginRight: "0.35rem" }} /> Link (TikTok / Reels / Shorts)
                </button>
              </div>
            </label>

            {refMode === "upload" && (
              <label>
                Arquivo do Vídeo de Referência (.mp4, .mov)
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setRefFile(e.target.files?.[0] ?? null)}
                  style={{ marginTop: "0.35rem" }}
                />
                {refFile && (
                  <small style={{ color: "var(--primary)", marginTop: "0.25rem", display: "block" }}>
                    ✓ Arquivo selecionado: <strong>{refFile.name}</strong> ({formatBytes(refFile.size)})
                  </small>
                )}
              </label>
            )}

            {refMode === "link" && (
              <label>
                Link do Vídeo Modelo de Referência
                <input
                  type="url"
                  placeholder="https://www.tiktok.com/@exemplo/video/… ou https://www.instagram.com/reels/…"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  style={{ marginTop: "0.35rem" }}
                />
              </label>
            )}

            {/* Configuração de B-Rolls Inteligentes com Higgsfield */}
            <div
              style={{
                marginTop: "0.5rem",
                padding: "0.75rem",
                background: "rgba(0, 0, 0, 0.2)",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.6rem", cursor: "pointer", margin: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: "1.15rem", height: "1.15rem", accentColor: "var(--primary)", cursor: "pointer" }}
                  checked={useBroll}
                  onChange={(e) => setUseBroll(e.target.checked)}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    🎬 Inserir B-Rolls Cinematográficos nos Ganchos
                  </strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                    Vídeos de apoio gerados para reforçar momentos de maior retenção.
                  </small>
                </div>
              </label>

              {useBroll && (
                <div style={{ marginTop: "0.65rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <label style={{ fontSize: "0.82rem", margin: 0 }}>
                    Motor de Geração de Vídeo:
                    <select
                      value={brollSource}
                      onChange={(e) => setBrollSource(e.target.value as "pexels" | "higgsfield")}
                      style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}
                    >
                      <option value="higgsfield">Higgsfield AI (Vídeos Cinematográficos Gerados por IA)</option>
                      <option value="pexels">Pixabay (Banco de Vídeos Gratuito)</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div className="grid2" style={{ marginTop: "0.5rem" }}>
              <label>
                Estilo / Vibe do Corte:
                <select value={refStyle} onChange={(e) => setRefStyle(e.target.value)}>
                  {STYLE_PRESETS.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Instruções Adicionais (Opcional):
                <input
                  type="text"
                  placeholder="Ex: Focar em falas de superação ou ganchos polêmicos"
                  value={designInstructions}
                  onChange={(e) => setDesignInstructions(e.target.value)}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO: B-ROLL ISOLADO (QUANDO NÃO USAR COPIAR ESTILO) */}
      {!copyStyle && (
        <div className="card" style={{ border: "1px dashed rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.03)", padding: "0.85rem" }}>
          <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.65rem", cursor: "pointer", margin: 0 }}>
            <input
              type="checkbox"
              style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--primary)", cursor: "pointer" }}
              checked={useBroll}
              onChange={(e) => setUseBroll(e.target.checked)}
            />
            <div>
              <strong style={{ fontSize: "0.92rem", color: "var(--text)" }}>🎬 Inserir B-Rolls automáticos nos momentos-chave</strong>
              <small style={{ display: "block", color: "var(--text-muted)" }}>
                Intercala vídeos de apoio em Full HD para aumentar a retenção.
              </small>
            </div>
          </label>

          {useBroll && (
            <div style={{ marginTop: "0.75rem", paddingTop: "0.65rem", borderTop: "1px solid var(--card-border)" }}>
              <label>
                Provedor de B-Roll:
                <select value={brollSource} onChange={(e) => setBrollSource(e.target.value as "pexels" | "higgsfield")}>
                  <option value="higgsfield">Higgsfield AI (Animações e Cenas com IA)</option>
                  <option value="pexels">Pixabay (Vídeos de Banco Gratuitos)</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO: TIPOGRAFIA VIRAL & SOUND DESIGN (FASE 4 + HYPERFRAMES) */}
      <div className="card stack" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--card-border)", padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <strong style={{ fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--primary)" }}>
            <span>🎨</span> Estilo de Legenda & Sound Design
          </strong>
          <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", fontSize: "0.72rem" }}>
            Alta Retenção
          </span>
        </div>

        <div className="grid2" style={{ marginTop: "0.5rem" }}>
          <label>
            Estilo Visual das Legendas:
            <select
              value={subtitleStyle}
              onChange={(e) => setSubtitleStyle(e.target.value as any)}
              style={{ marginTop: "0.3rem" }}
            >
              <option value="hormozi">Hormozi Bold (Amarelo vibrante, contorno preto espesso)</option>
              <option value="apple">Apple Minimal (Tipografia limpa, cantos suaves, estilo Apple)</option>
              <option value="beast">Beast Pop (Cores neon dinâmicas e ritmo ultra-rápido)</option>
              <option value="minimal">Minimal Podcast (Subtítulo discreto e refinado na base)</option>
            </select>
          </label>

          <div className="stack" style={{ gap: "0.5rem", justifyContent: "center" }}>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5rem", cursor: "pointer", margin: 0 }}>
              <input
                type="checkbox"
                checked={enableEmojis}
                onChange={(e) => setEnableEmojis(e.target.checked)}
                style={{ width: "1.1rem", height: "1.1rem", accentColor: "var(--primary)", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                ✨ Injetar Emojis Automáticos (🚀, 💰, 💡, 🎯)
              </span>
            </label>

            <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5rem", cursor: "pointer", margin: 0 }}>
              <input
                type="checkbox"
                checked={enableSfx}
                onChange={(e) => setEnableSfx(e.target.checked)}
                style={{ width: "1.1rem", height: "1.1rem", accentColor: "var(--primary)", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                🔊 Sound Design (Whoosh, Pop e Ding sincronizados)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Modo Rascunho */}
      <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}>
        <input
          type="checkbox"
          style={{ width: "1.1rem", height: "1.1rem", accentColor: "var(--primary)", cursor: "pointer" }}
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
        />
        <span style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
          Modo Rascunho (apenas escolhe os trechos, sem cortar os arquivos)
        </span>
      </label>

      {uploadPct !== null && (
        <div>
          <div className="row" style={{ marginBottom: "0.3rem" }}>
            <small>Enviando vídeo para o servidor…</small>
            <small><strong>{uploadPct}%</strong></small>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}

      {hasNoCredits && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "#f87171",
            fontSize: "0.88rem",
            lineHeight: 1.4,
          }}
        >
          ⚠️ <strong>Saldo de minutos esgotado (0.0 min).</strong> Você atingiu seu limite gratuito de processamento. Fale com o administrador para recarregar sua conta.
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {/* Botão de Ação Principal (CTA) */}
      <button type="submit" className="btn-cta" disabled={busy || hasNoCredits}>
        {busy ? (
          uploadPct !== null ? (
            `Enviando vídeo… ${uploadPct}%`
          ) : (
            "Processando pedido…"
          )
        ) : (
          <>
            <SparklesIcon size={18} />
            <span>Gerar Cortes com IA</span>
          </>
        )}
      </button>
    </form>
  );
}
