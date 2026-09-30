"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadResumable } from "@/lib/upload";

// Limite de upload exibido no site. Deve ser <= ao limite configurado em Storage > Settings do Supabase.
// Plano gratuito: 50. Depois de subir o limite no plano Pro, ajuste NEXT_PUBLIC_MAX_UPLOAD_MB.
const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;
const RESUMABLE_FROM_BYTES = 6 * 1024 * 1024; // acima disso, usa envio retomável (TUS)

function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
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
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [verticalMode, setVerticalMode] = useState<"crop" | "blur" | "split">("crop");
  const [cropPct, setCropPct] = useState(50);
  const [clipCount, setClipCount] = useState(10);
  const [minSeconds, setMinSeconds] = useState(30);
  const [maxSeconds, setMaxSeconds] = useState(90);
  const [language, setLanguage] = useState("pt-BR");

  // Opções de Vídeo de Referência e Design dos Cortes
  const [showRefSection, setShowRefSection] = useState(false);
  const [refMode, setRefMode] = useState<"none" | "link" | "upload">("none");
  const [refUrl, setRefUrl] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refStyle, setRefStyle] = useState(STYLE_PRESETS[0].name);
  const [designInstructions, setDesignInstructions] = useState("");

  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (minSeconds < 5 || maxSeconds > 180 || minSeconds >= maxSeconds) {
      return setError("A duração mínima deve ser de pelo menos 5 s, a máxima de até 180 s, e a mínima menor que a máxima.");
    }
    if (clipCount < 1 || clipCount > 30) return setError("A quantidade de clipes deve ficar entre 1 e 30.");

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
        return setError("Links do Google Drive ainda não são suportados. Use um link de vídeo (ex.: YouTube) ou envie o arquivo.");
      }
      source = { source_type: "link", source_url: parsed.toString() };
    } else {
      if (!file) {
        setBusy(false);
        return setError("Escolha um arquivo de vídeo principal.");
      }
      if (!file.type.startsWith("video/")) {
        setBusy(false);
        return setError("O arquivo principal precisa ser um vídeo.");
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setBusy(false);
        return setError(`O arquivo tem mais de ${MAX_UPLOAD_MB} MB. Use um link do vídeo no lugar.`);
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
          const { error } = await supabase.storage.from("sources").upload(path, file, { contentType: file.type });
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
      if (!refFile.type.startsWith("video/")) {
        setBusy(false);
        return setError("O arquivo de referência precisa ser um vídeo.");
      }
      const refStoragePath = `${userId}/ref-${crypto.randomUUID()}-${safeName(refFile.name)}`;
      try {
        const { error: refUpError } = await supabase.storage.from("sources").upload(refStoragePath, refFile, { contentType: refFile.type });
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
      <h2>Novo pedido de cortes</h2>

      {/* Tipo de Entrada do Vídeo Principal */}
      <div className="tabs" role="tablist">
        <button type="button" className={mode === "link" ? "tab active" : "tab"} onClick={() => setMode("link")}>
          Link do vídeo
        </button>
        <button type="button" className={mode === "upload" ? "tab active" : "tab"} onClick={() => setMode("upload")}>
          Enviar arquivo
        </button>
      </div>

      {mode === "link" ? (
        <label>
          Link do vídeo principal
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>
      ) : (
        <label>
          Arquivo de vídeo principal (até {MAX_UPLOAD_MB} MB)
          <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          {MAX_UPLOAD_MB <= 50 && <small>Para vídeos maiores, use o link.</small>}
        </label>
      )}

      {/* Configurações de Formato e Idioma */}
      <div className="grid2">
        <label>
          Formato dos cortes
          <select value={orientation} onChange={(e) => setOrientation(e.target.value as "vertical" | "horizontal")}>
            <option value="vertical">Vertical (9:16) — Reels / TikTok / Shorts</option>
            <option value="horizontal">Horizontal (16:9) — YouTube / Web</option>
          </select>
        </label>
        <label>
          Idioma falado no vídeo
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">Inglês</option>
            <option value="es">Espanhol</option>
          </select>
        </label>
      </div>

      {/* Opções de Enquadramento para Vertical */}
      {orientation === "vertical" && (
        <div className="card" style={{ background: "rgba(0,0,0,0.02)", borderColor: "var(--line)" }}>
          <label style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Layout de Design Vertical:</label>
          <div className="grid3" style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              className={`tab ${verticalMode === "crop" ? "active" : ""}`}
              onClick={() => setVerticalMode("crop")}
            >
              📱 <strong>Crop Focado</strong>
              <small style={{ display: "block", fontSize: "0.75rem", opacity: 0.85 }}>Preenche tela 9:16</small>
            </button>
            <button
              type="button"
              className={`tab ${verticalMode === "blur" ? "active" : ""}`}
              onClick={() => setVerticalMode("blur")}
            >
              🎞️ <strong>Fundo Desfocado</strong>
              <small style={{ display: "block", fontSize: "0.75rem", opacity: 0.85 }}>Vídeo central + Blur</small>
            </button>
            <button
              type="button"
              className={`tab ${verticalMode === "split" ? "active" : ""}`}
              onClick={() => setVerticalMode("split")}
            >
              🎙️ <strong>Split Screen</strong>
              <small style={{ display: "block", fontSize: "0.75rem", opacity: 0.85 }}>Podcast (Topo/Base)</small>
            </button>
          </div>

          {verticalMode === "crop" && (
            <label>
              Ajuste de posição horizontal: {cropPct}% ({cropPct < 40 ? "Esquerda" : cropPct > 60 ? "Direita" : "Centro"})
              <input type="range" min={0} max={100} value={cropPct} onChange={(e) => setCropPct(Number(e.target.value))} />
              <small>Posiciona a câmera vertical no ponto principal do vídeo.</small>
            </label>
          )}
        </div>
      )}

      {/* SEÇÃO: VÍDEO DE REFERÊNCIA & DIRETRIZES DE DESIGN */}
      <div className="card" style={{ border: "1px dashed var(--accent)", background: "rgba(91, 61, 245, 0.03)" }}>
        <div className="row" style={{ cursor: "pointer" }} onClick={() => setShowRefSection(!showRefSection)}>
          <div>
            <strong style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--accent)" }}>
              <span>🎨</span> Vídeo de Referência &amp; Design dos Cortes
            </strong>
            <small style={{ display: "block", color: "var(--muted)" }}>
              Defina o estilo visual, ritmo, dinâmica ou use um vídeo de exemplo (TikTok/Reels) como modelo.
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
            {showRefSection ? "Recolher ▲" : "+ Configurar Referência ▼"}
          </button>
        </div>

        {showRefSection && (
          <div className="stack" style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--line)" }}>
            <label>
              <strong>Estilo Viral Predeterminado:</strong>
              <select value={refStyle} onChange={(e) => setRefStyle(e.target.value)}>
                {STYLE_PRESETS.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <strong>Como deseja fornecer o Vídeo de Referência?</strong>
              <div className="tabs" style={{ marginTop: "0.3rem" }}>
                <button
                  type="button"
                  className={refMode === "none" ? "tab active" : "tab"}
                  onClick={() => setRefMode("none")}
                >
                  Apenas Preset / Instruções
                </button>
                <button
                  type="button"
                  className={refMode === "link" ? "tab active" : "tab"}
                  onClick={() => setRefMode("link")}
                >
                  Link do Vídeo
                </button>
                <button
                  type="button"
                  className={refMode === "upload" ? "tab active" : "tab"}
                  onClick={() => setRefMode("upload")}
                >
                  Enviar Arquivo
                </button>
              </div>
            </label>

            {refMode === "link" && (
              <label>
                Link do vídeo de referência (TikTok, Instagram Reels, Shorts, etc.)
                <input
                  type="url"
                  placeholder="https://www.tiktok.com/@exemplo/video/… ou https://www.instagram.com/reels/…"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                />
                <small>A IA usará o estilo, ritmo e estrutura deste vídeo como guia de corte.</small>
              </label>
            )}

            {refMode === "upload" && (
              <label>
                Arquivo de vídeo de referência (até {MAX_UPLOAD_MB} MB)
                <input type="file" accept="video/*" onChange={(e) => setRefFile(e.target.files?.[0] ?? null)} />
                <small>Envie um clipe de exemplo que represente o design ou formato que você deseja.</small>
              </label>
            )}

            <label>
              <strong>Diretrizes de Edição &amp; Design (Prompt para a IA):</strong>
              <textarea
                rows={3}
                style={{
                  font: "inherit",
                  padding: "0.55rem 0.65rem",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  background: "var(--bg)",
                  color: "var(--text)",
                  width: "100%",
                  resize: "vertical",
                }}
                placeholder="Exemplo: Quero cortes com falas polêmicas ou curiosas no gancho inicial. Mantenha os cortes com ritmo dinâmico e conclua sempre na punchline."
                value={designInstructions}
                onChange={(e) => setDesignInstructions(e.target.value)}
              />
              <small>Instruções adicionais para o Claude selecionar os melhores momentos seguindo seu estilo.</small>
            </label>
          </div>
        )}
      </div>

      {/* Limites de Clipes e Duração */}
      <div className="grid3">
        <label>
          Qtd. de clipes
          <input type="number" min={1} max={30} value={clipCount} onChange={(e) => setClipCount(Number(e.target.value))} />
        </label>
        <label>
          Mínimo (s)
          <input type="number" min={5} max={170} value={minSeconds} onChange={(e) => setMinSeconds(Number(e.target.value))} />
        </label>
        <label>
          Máximo (s)
          <input type="number" min={10} max={180} value={maxSeconds} onChange={(e) => setMaxSeconds(Number(e.target.value))} />
        </label>
      </div>

      {uploadPct !== null && (
        <div className="bar">
          <div className="bar-fill" style={{ width: `${uploadPct}%` }} />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>
        {busy ? (uploadPct !== null ? `Enviando… ${uploadPct}%` : "Enviando…") : "Gerar cortes com IA"}
      </button>
    </form>
  );
}
