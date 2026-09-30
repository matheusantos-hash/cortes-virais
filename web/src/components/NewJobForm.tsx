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

export default function NewJobForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [cropPct, setCropPct] = useState(50);
  const [clipCount, setClipCount] = useState(10);
  const [minSeconds, setMinSeconds] = useState(30);
  const [maxSeconds, setMaxSeconds] = useState(90);
  const [language, setLanguage] = useState("pt-BR");
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
        return setError("Escolha um arquivo de vídeo.");
      }
      if (!file.type.startsWith("video/")) {
        setBusy(false);
        return setError("O arquivo precisa ser um vídeo.");
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
        return setError(`Falha ao enviar o arquivo: ${upError}`);
      }
      source = { source_type: "upload", source_path: path };
    }

    const { error: insError } = await supabase.from("jobs").insert({
      ...source,
      orientation,
      crop_x: cropPct / 100,
      clip_count: clipCount,
      min_seconds: minSeconds,
      max_seconds: maxSeconds,
      language,
    });
    setBusy(false);
    if (insError) return setError(`Não foi possível criar o pedido: ${insError.message}`);

    setUrl("");
    setFile(null);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h2>Novo pedido de cortes</h2>

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
          Link do vídeo
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      ) : (
        <label>
          Arquivo de vídeo (até {MAX_UPLOAD_MB} MB)
          <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {MAX_UPLOAD_MB <= 50 && <small>Para vídeos maiores, use o link.</small>}
        </label>
      )}

      <div className="grid2">
        <label>
          Formato dos cortes
          <select value={orientation} onChange={(e) => setOrientation(e.target.value as "vertical" | "horizontal")}>
            <option value="vertical">Vertical (9:16)</option>
            <option value="horizontal">Horizontal (16:9)</option>
          </select>
        </label>
        <label>
          Idioma do vídeo
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">Inglês</option>
            <option value="es">Espanhol</option>
          </select>
        </label>
      </div>

      {orientation === "vertical" && (
        <label>
          Enquadramento horizontal do corte: {cropPct}% ({cropPct < 40 ? "esquerda" : cropPct > 60 ? "direita" : "centro"})
          <input type="range" min={0} max={100} value={cropPct} onChange={(e) => setCropPct(Number(e.target.value))} />
          <small>Define qual parte do vídeo fica na tela vertical.</small>
        </label>
      )}

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
        {busy ? (uploadPct !== null ? `Enviando… ${uploadPct}%` : "Enviando…") : "Gerar cortes"}
      </button>
    </form>
  );
}
