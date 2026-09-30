"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadResumable } from "@/lib/upload";

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
  { id: "ganchos_rapidos", name: "🔥 Ganchos Rápidos (TikTok/Reels)", desc: "Cortes dinâmicos com abertura impactante e ritmo acelerado" },
  { id: "podcast", name: "🎙️ Podcast & Entrevistas", desc: "Focado em perguntas instigantes, respostas marcantes e diálogos" },
  { id: "storytelling", name: "💡 Storytelling & Reflexão", desc: "Histórias envolventes com começo, meio e desfecho emocionante" },
  { id: "educacional", name: "🧠 Educacional & Dicas Práticas", desc: "Explicações diretas ao ponto com alto valor informativo" },
  { id: "humor", name: "🎭 Humor & Momentos Cômicos", desc: "Piadas, reações engraçadas e momentos descontraídos" },
];

export default function NewJobForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [verticalMode, setVerticalMode] = useState<"crop" | "blur" | "split">("crop");
  const [cropPct, setCropPct] = useState(50);
  const [clipCount, setClipCount] = useState(5);
  const [minSeconds, setMinSeconds] = useState(30);
  const [maxSeconds, setMaxSeconds] = useState(90);
  const [language, setLanguage] = useState("pt-BR");
  const [dryRun, setDryRun] = useState(false);

  // Opções de Vídeo de Referência e Design
  const [showRefSection, setShowRefSection] = useState(false);
  const [refMode, setRefMode] = useState<"none" | "link" | "upload">("none");
  const [refUrl, setRefUrl] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refStyle, setRefStyle] = useState(STYLE_PRESETS[0].name);
  const [designInstructions, setDesignInstructions] = useState("");

  // Opções de B-Roll
  const [useBroll, setUseBroll] = useState(false);
  const [brollSource, setBrollSource] = useState<"pexels" | "higgsfield">("pexels");

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

    if (minSeconds < 5 || maxSeconds > 180 || minSeconds >= maxSeconds) {
      return setError("A duração mínima deve ser de pelo menos 5 s, a máxima de até 180 s, e a mínima menor que a máxima.");
    }
    if (clipCount < 1 || clipCount > 20) {
      return setError("A quantidade de cortes deve ficar entre 1 e 20.");
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

    // Processamento do Vídeo de Referência (se fornecido)
    let refPath: string | null = null;
    if (showRefSection && refMode === "upload" && refFile) {
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

    const { error: insError } = await supabase.from("jobs").insert({
      ...source,
      orientation,
      vertical_mode: orientation === "vertical" ? verticalMode : "crop",
      crop_x: cropPct / 100,
      clip_count: clipCount,
      min_seconds: minSeconds,
      max_seconds: maxSeconds,
      language,
      reference_type: showRefSection ? refMode : "none",
      reference_url: showRefSection && refMode === "link" && refUrl.trim() ? refUrl.trim() : null,
      reference_path: refPath,
      reference_style: showRefSection ? refStyle : null,
      design_instructions: showRefSection && designInstructions.trim() ? designInstructions.trim() : null,
      use_broll: useBroll,
      broll_source: useBroll ? brollSource : "none",
    });

    setBusy(false);
    if (insError) return setError(`Não foi possível criar o pedido: ${insError.message}`);

    setUrl("");
    setFile(null);
    setRefUrl("");
    setRefFile(null);
    setDesignInstructions("");
    onCreated();
  }

  return (
    <form onSubmit={submit} className="card stack">
      <div className="row" style={{ alignItems: "center" }}>
        <h2>Criar Cortes com IA</h2>
        <span className="badge badge-queued" style={{ fontSize: "0.72rem" }}>Claude 3.5 + FFmpeg</span>
      </div>

      {/* Abas de Origem (Tabs) */}
      <div className="tabs" role="tablist">
        <button
          type="button"
          className={mode === "link" ? "tab active" : "tab"}
          onClick={() => { setMode("link"); setError(null); }}
        >
          <span>🔗 Link de Vídeo</span>
          <small style={{ fontSize: "0.72rem", opacity: 0.8 }}>YouTube / Web</small>
        </button>
        <button
          type="button"
          className={mode === "upload" ? "tab active" : "tab"}
          onClick={() => { setMode("upload"); setError(null); }}
        >
          <span>📁 Enviar Arquivo</span>
          <small style={{ fontSize: "0.72rem", opacity: 0.8 }}>Upload direto</small>
        </button>
      </div>

      {mode === "link" ? (
        <label>
          URL do Vídeo (YouTube)
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
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
            className={`dropzone ${dragOver ? "dragover" : ""}`}
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
            <span className="dropzone-icon">📥</span>
            {file ? (
              <div>
                <strong style={{ color: "var(--text)", display: "block" }}>{file.name}</strong>
                <span className="muted small">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  className="link danger small"
                  style={{ display: "block", marginTop: "0.4rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  ✕ Remover arquivo
                </button>
              </div>
            ) : (
              <div>
                <strong style={{ color: "var(--text)", display: "block", fontSize: "0.95rem" }}>
                  Arraste e solte o vídeo aqui
                </strong>
                <span className="muted small">ou clique para selecionar do computador (até {MAX_UPLOAD_MB} MB)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seletor Visual de Formato (Cards Clicáveis) */}
      <div>
        <label style={{ marginBottom: "0.4rem" }}>Formato de Saída:</label>
        <div className="format-grid">
          <div
            className={`format-card ${orientation === "vertical" ? "active" : ""}`}
            onClick={() => setOrientation("vertical")}
          >
            <div className="format-card-title">
              <span>📱 Vertical (9:16)</span>
              <span className="format-tag">Viral</span>
            </div>
            <span className="muted small">Otimizado para TikTok, Reels e YouTube Shorts.</span>
          </div>

          <div
            className={`format-card ${orientation === "horizontal" ? "active" : ""}`}
            onClick={() => setOrientation("horizontal")}
          >
            <div className="format-card-title">
              <span>🖥️ Horizontal (16:9)</span>
              <span className="format-tag" style={{ background: "rgba(255,255,255,0.08)", color: "#cbd5e1" }}>Padrão</span>
            </div>
            <span className="muted small">Widescreen para YouTube tradicional e sites.</span>
          </div>
        </div>
      </div>

      {/* Opções de Enquadramento Vertical (somente se 9:16 estiver ativo) */}
      {orientation === "vertical" && (
        <div className="card" style={{ background: "rgba(0,0,0,0.25)", borderColor: "var(--card-border)", padding: "0.9rem" }}>
          <label style={{ marginBottom: "0.45rem" }}>Enquadramento da Câmera Vertical:</label>
          <div className="framing-grid">
            <div
              className={`framing-card ${verticalMode === "crop" ? "active" : ""}`}
              onClick={() => setVerticalMode("crop")}
            >
              📱 <strong>Preencher (Crop)</strong>
              <small style={{ display: "block", opacity: 0.8, fontSize: "0.72rem" }}>Corta as laterais</small>
            </div>
            <div
              className={`framing-card ${verticalMode === "blur" ? "active" : ""}`}
              onClick={() => setVerticalMode("blur")}
            >
              🎞️ <strong>Fundo Blur</strong>
              <small style={{ display: "block", opacity: 0.8, fontSize: "0.72rem" }}>Vídeo + desfoque</small>
            </div>
            <div
              className={`framing-card ${verticalMode === "split" ? "active" : ""}`}
              onClick={() => setVerticalMode("split")}
            >
              🎙️ <strong>Split Screen</strong>
              <small style={{ display: "block", opacity: 0.8, fontSize: "0.72rem" }}>Podcast 2 câmeras</small>
            </div>
          </div>

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
            max={170}
            value={minSeconds}
            onChange={(e) => setMinSeconds(Number(e.target.value))}
          />
        </label>
        <label>
          Duração Máx. (s)
          <input
            type="number"
            min={10}
            max={180}
            value={maxSeconds}
            onChange={(e) => setMaxSeconds(Number(e.target.value))}
          />
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

      {/* SEÇÃO: VÍDEO DE REFERÊNCIA & DIRETRIZES DE DESIGN */}
      <div className="card" style={{ border: "1px dashed rgba(99, 102, 241, 0.4)", background: "rgba(99, 102, 241, 0.03)", padding: "0.85rem" }}>
        <div className="row" style={{ cursor: "pointer" }} onClick={() => setShowRefSection(!showRefSection)}>
          <div>
            <strong style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)" }}>
              <span>🎨</span> Vídeo de Referência &amp; Design
            </strong>
            <small style={{ display: "block", color: "var(--text-muted)" }}>
              Instruções de estilo ou link de corte viral como modelo.
            </small>
          </div>
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              setShowRefSection(!showRefSection);
            }}
          >
            {showRefSection ? "Recolher ▲" : "+ Configurar ▼"}
          </button>
        </div>

        {showRefSection && (
          <div className="stack" style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid var(--card-border)" }}>
            <label>
              Estilo Viral Predeterminado:
              <select value={refStyle} onChange={(e) => setRefStyle(e.target.value)}>
                {STYLE_PRESETS.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Origem do Vídeo de Referência:
              <div className="tabs" style={{ marginTop: "0.25rem" }}>
                <button
                  type="button"
                  className={refMode === "none" ? "tab active" : "tab"}
                  onClick={() => setRefMode("none")}
                >
                  Nenhum
                </button>
                <button
                  type="button"
                  className={refMode === "link" ? "tab active" : "tab"}
                  onClick={() => setRefMode("link")}
                >
                  Link
                </button>
                <button
                  type="button"
                  className={refMode === "upload" ? "tab active" : "tab"}
                  onClick={() => setRefMode("upload")}
                >
                  Arquivo
                </button>
              </div>
            </label>

            {refMode === "link" && (
              <label>
                Link de Referência (TikTok, Reels, Shorts)
                <input
                  type="url"
                  placeholder="https://www.tiktok.com/@exemplo/video/…"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                />
              </label>
            )}

            {refMode === "upload" && (
              <label>
                Arquivo de Exemplo
                <input type="file" accept="video/*" onChange={(e) => setRefFile(e.target.files?.[0] ?? null)} />
              </label>
            )}

            <label>
              Diretrizes de Edição (Prompt para o Claude AI):
              <textarea
                rows={2}
                placeholder="Exemplo: Priorize momentos polêmicos ou lições de negócio com gancho forte."
                value={designInstructions}
                onChange={(e) => setDesignInstructions(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      {/* SEÇÃO: B-ROLL AUTOMÁTICO VIA PEXELS */}
      <div className="card" style={{ border: "1px dashed rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.03)", padding: "0.85rem" }}>
        <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.65rem", cursor: "pointer" }}>
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
                <option value="pexels">Pexels (Vídeos Full HD gratuitos &amp; rápidos)</option>
                <option value="higgsfield">Higgsfield AI (Animações IA)</option>
              </select>
            </label>
          </div>
        )}
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

      {error && <p className="error">{error}</p>}

      {/* Botão de Ação Principal (CTA) */}
      <button type="submit" className="btn-cta" disabled={busy}>
        {busy ? (
          uploadPct !== null ? (
            `Enviando vídeo… ${uploadPct}%`
          ) : (
            "Processando pedido…"
          )
        ) : (
          "✨ Gerar Cortes com IA"
        )}
      </button>
    </form>
  );
}
