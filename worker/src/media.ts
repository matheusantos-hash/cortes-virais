import { execFile, spawn } from "node:child_process";
import { createWriteStream, existsSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ensureSfxAssets, type SfxEvent } from "./sfx.js";
import type { Orientation, VerticalMode, CanvasBroll } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CanceledError extends Error {
  constructor(message = "Processamento cancelado pelo usuário.") {
    super(message);
    this.name = "CanceledError";
  }
}

export interface ActiveBroll {
  filePath: string;
  offsetSec: number;
  durationSec: number;
}

function run(cmd: string, args: string[], signal?: AbortSignal, onLog?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new CanceledError());
    }

    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stderrChunks: string[] = [];

    const handleAbort = () => {
      try {
        p.kill("SIGTERM");
        setTimeout(() => {
          if (!p.killed) p.kill("SIGKILL");
        }, 1000);
      } catch {}
      reject(new CanceledError());
    };

    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    p.stdout?.on("data", (d) => {
      const line = d.toString().trim();
      if (line && onLog) onLog(line);
    });

    const BENIGN_WARNINGS = [
      "mmco: unref",
      "Last message repeated",
      "non-existing PPS",
      "no frame!",
      "deprecated pixel format",
    ];

    p.stderr?.on("data", (d) => {
      const str = d.toString();
      stderrChunks.push(str);
      const line = str.trim();
      const isBenign = BENIGN_WARNINGS.some((w) => line.includes(w));
      if (line && onLog && !isBenign) onLog(line);
    });

    p.on("error", (err) => {
      if (signal) signal.removeEventListener("abort", handleAbort);
      reject(new Error(`Não consegui executar "${cmd}". Ele está instalado e no PATH? (${err.message})`));
    });

    p.on("close", (code, signalName) => {
      if (signal) signal.removeEventListener("abort", handleAbort);
      if (signal?.aborted) {
        reject(new CanceledError());
      } else if (code === 0) {
        resolve();
      } else {
        const fullErr = stderrChunks.join("").trim();
        const lastLines = fullErr.split("\n").filter(Boolean).slice(-3).join(" | ");
        const signalMsg = signalName ? ` (sinal do sistema: ${signalName})` : "";
        reject(new Error(`${cmd} terminou com código ${code}${signalMsg}${lastLines ? `: ${lastLines}` : ""}`));
      }
    });
  });
}

const AUDIO_KBPS = 160;

/**
 * Limita o bitrate para que cada clipe caiba no limite de upload do Storage.
 * Tamanho máximo por clipe em MB: variável MAX_CLIP_MB (padrão 45; 0 desliga o limite).
 */
function videoRateArgs(durationSec: number): string[] {
  const maxMb = Number(process.env.MAX_CLIP_MB ?? 45);
  if (!Number.isFinite(maxMb) || maxMb <= 0) return [];
  const kbps = Math.floor((maxMb * 8192) / durationSec - AUDIO_KBPS);
  const video = Math.min(8000, Math.max(1500, kbps));
  return ["-maxrate", `${video}k`, "-bufsize", `${video * 2}k`];
}

const DIRECT_TYPES = /^(video\/|application\/(octet-stream|mp4)|binary\/octet-stream)/i;

export type DirectResult = "ok" | "not-direct" | "too-large";

/**
 * Tenta baixar o link como ARQUIVO DIRETO de vídeo (Box, Dropbox, servidor próprio…).
 * Só baixa se o servidor responder com um tipo de vídeo/binário; páginas HTML e streams
 * (m3u8) devolvem "not-direct" e ficam para o yt-dlp.
 */
export async function tryDirectDownload(url: string, dest: string, signal?: AbortSignal): Promise<DirectResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000); // só para receber os cabeçalhos
  
  if (signal) {
    signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (cortes-virais-worker)" },
    });
  } catch (err: any) {
    if (signal?.aborted) throw new CanceledError();
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !res.body || !DIRECT_TYPES.test(type)) {
    await res.body?.cancel().catch(() => {});
    return "not-direct";
  }

  const maxGb = Number(process.env.MAX_DOWNLOAD_GB ?? 20);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > maxGb * 1024 ** 3) {
    await res.body.cancel().catch(() => {});
    return "too-large";
  }

  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest), { signal });
  return "ok";
}

/**
 * Normaliza URLs de plataformas conhecidas para contornar proteções ou exigências de login.
 * Exemplo: Vimeo bloqueia requisições em 'vimeo.com/<id>' exigindo login, mas aceita
 * 'player.vimeo.com/video/<id>' sem autenticação e sem restrições.
 */
export function normalizeVideoUrl(rawUrl: string): { url: string; referer?: string } {
  try {
    const parsed = new URL(rawUrl);
    // Trata links do Vimeo
    if (/vimeo\.com$/i.test(parsed.hostname) && !parsed.hostname.startsWith("player.")) {
      // Suporta vimeo.com/123456789 e vimeo.com/123456789/hash-de-privacidade
      const matches = parsed.pathname.match(/\/(\d{5,})(?:\/([a-zA-Z0-9]+))?/);
      if (matches) {
        const id = matches[1];
        const hash = matches[2];
        const embedUrl = hash 
          ? `https://player.vimeo.com/video/${id}?h=${hash}`
          : `https://player.vimeo.com/video/${id}`;
        return { url: embedUrl, referer: "https://vimeo.com/" };
      }
    }
  } catch {
    // segue com a url original se houver erro de parse
  }
  return { url: rawUrl };
}

/**
 * Verifica se a URL é do provedor de armazenamento Box.com.
 */
export function isBoxUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return /(^|\.)box\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Resolve uma URL compartilhada do Box.com para a URL direta assinada de download/streaming (HTTP Range compatível).
 */
export async function resolveBoxDirectUrl(rawUrl: string, signal?: AbortSignal): Promise<string> {
  // Caso a URL já seja direta de download assinada
  if (/boxcloud\.com\/d\/1\//i.test(rawUrl)) {
    return rawUrl;
  }

  let sharedName: string | null = null;
  let fileId: string | null = null;

  try {
    const parsed = new URL(rawUrl);
    const sMatch = parsed.pathname.match(/\/s\/([a-zA-Z0-9_-]+)/);
    if (sMatch) sharedName = sMatch[1];

    const fMatch = parsed.pathname.match(/\/file\/(\d+)/);
    if (fMatch) fileId = fMatch[1];
  } catch {}

  // Se tivermos apenas o sharedName sem fileId, busca a página inicial do link para extrair o ID do arquivo
  if (sharedName && !fileId) {
    try {
      const pageRes = await fetch(rawUrl, {
        signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const matchFileId =
          html.match(/"typedID"\s*:\s*"f_(\d+)"/) ||
          html.match(/"itemID"\s*:\s*"f_(\d+)"/) ||
          html.match(/\/file\/(\d+)/);
        if (matchFileId) {
          fileId = matchFileId[1];
        }
      }
    } catch (e: any) {
      if (signal?.aborted) throw new CanceledError();
    }
  }

  if (sharedName && fileId) {
    const dlEndpoint = `https://app.box.com/index.php?rm=box_download_shared_file&shared_name=${sharedName}&file_id=f_${fileId}`;
    const headRes = await fetch(dlEndpoint, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });

    const location = headRes.headers.get("location");
    if (location) {
      return location;
    }
  }

  // Fallback: se não conseguiu via endpoint acima, tenta pegar a URL final
  try {
    const res = await fetch(rawUrl, {
      method: "HEAD",
      redirect: "follow",
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (res.url && res.url !== rawUrl) {
      return res.url;
    }
  } catch {}

  throw new Error("Não foi possível resolver o link de streaming direto do Box.com.");
}

/**
 * Baixa apenas um segmento/trecho específico de vídeo a partir de uma URL remota (via HTTP Range seek no FFmpeg).
 */
export async function downloadVideoSegment(
  remoteUrl: string,
  startSec: number,
  durationSec: number,
  outPath: string,
  signal?: AbortSignal,
  onLog?: (line: string) => void
): Promise<void> {
  const isHttp = /^https?:\/\//i.test(remoteUrl);
  const userAgentArgs = isHttp ? ["-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"] : [];
  await run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      ...userAgentArgs,
      "-ss",
      startSec.toFixed(3),
      "-i",
      remoteUrl,
      "-t",
      durationSec.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-avoid_negative_ts",
      "make_zero",
      outPath,
    ],
    signal,
    onLog
  );
}

let cookiesFilePath: string | null = null;
function getCookiesPath(): string | null {
  if (cookiesFilePath && existsSync(cookiesFilePath)) return cookiesFilePath;
  const rawCookies = process.env.YOUTUBE_COOKIES?.trim();
  if (rawCookies) {
    try {
      const p = path.join(os.tmpdir(), "yt_cookies.txt");
      writeFileSync(p, rawCookies, "utf-8");
      cookiesFilePath = p;
      return p;
    } catch (e) {
      console.error("Falha ao salvar YOUTUBE_COOKIES temporário:", e);
    }
  }
  return null;
}

/** Baixa o vídeo de um link (YouTube, Vimeo etc.) em MP4, até 1080p. */
export async function downloadVideo(url: string, outPath: string, signal?: AbortSignal, onLog?: (line: string) => void): Promise<void> {
  const norm = normalizeVideoUrl(url);
  const args = [
    "-f",
    "bv*[height<=1080]+ba/b[height<=1080]/best",
    "--merge-output-format",
    "mp4",
    "-o",
    outPath,
  ];

  if (norm.referer) {
    args.push("--referer", norm.referer);
  }

  // Drible de bloqueio anti-bot do YouTube:
  // 1. Alterna o cliente para iOS e Android (que não passam pelo bot-check restritivo de browser)
  if (/youtube\.com|youtu\.be/i.test(norm.url)) {
    args.push(
      "--retries", "5",
      "--fragment-retries", "5",
      "--retry-sleep", "2",
      "--extractor-args", "youtube:player_client=ios,android,web"
    );
    
    // 2. Se houver cookies configurados via env var YOUTUBE_COOKIES, injeta automaticamente
    const cookiesPath = getCookiesPath();
    if (cookiesPath) {
      args.push("--cookies", cookiesPath);
    }
  }

  args.push(norm.url);

  await run(
    "yt-dlp",
    args,
    signal,
    onLog
  );
}

/** Extrai só o áudio (mono, leve) para mandar à transcrição. */
export async function extractAudio(videoPath: string, audioPath: string, signal?: AbortSignal, onLog?: (line: string) => void): Promise<void> {
  const isHttp = /^https?:\/\//i.test(videoPath);
  const userAgentArgs = isHttp ? ["-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"] : [];
  await run(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      ...userAgentArgs,
      "-threads", "2",
      "-i", videoPath,
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k",
      audioPath,
    ],
    signal,
    onLog
  );
}

export interface FaceKeyframe {
  t: number;
  x: number;
}

export interface FaceTrackingResult {
  primaryCenterX: number;
  leftFaceCenterX: number;
  rightFaceCenterX: number;
  detectedCount: number;
  keyframes?: FaceKeyframe[];
}

/** Executa o rastreamento facial contínuo e inteligente no trecho do vídeo via detect_faces.py */
export async function detectFacesInVideo(
  videoPath: string,
  startSec: number,
  durationSec: number
): Promise<FaceTrackingResult> {
  try {
    const scriptPath = path.join(__dirname, "detect_faces.py");
    const out = await new Promise<string>((resolve) => {
      const args = [
        scriptPath,
        "--video", videoPath,
        "--start", startSec.toFixed(2),
        "--duration", durationSec.toFixed(2),
        "--step", "1.0",
      ];
      execFile("python3", args, (err, stdout) => {
        if (err) {
          execFile("python", args, (err2, stdout2) => {
            if (err2) resolve("{}");
            else resolve(stdout2);
          });
        } else {
          resolve(stdout);
        }
      });
    });

    const parsed = JSON.parse(out);
    return {
      primaryCenterX: typeof parsed.primary_center_x === "number" ? parsed.primary_center_x : 0.5,
      leftFaceCenterX: typeof parsed.left_face_center_x === "number" ? parsed.left_face_center_x : 0.25,
      rightFaceCenterX: typeof parsed.right_face_center_x === "number" ? parsed.right_face_center_x : 0.75,
      detectedCount: (parsed.keyframes ?? []).length,
      keyframes: Array.isArray(parsed.keyframes) ? parsed.keyframes : [],
    };
  } catch {
    return { primaryCenterX: 0.5, leftFaceCenterX: 0.25, rightFaceCenterX: 0.75, detectedCount: 0, keyframes: [] };
  }
}

/**
 * Realiza o re-corte (trimming) de um clipe MP4 com extrema precisão temporal e re-encode ultrarrápido.
 */
export async function trimClip(opts: {
  input: string;
  output: string;
  trimStartSec: number;
  trimEndSec: number;
  canvasBrolls?: CanvasBroll[];
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<void> {
  const { input, output, trimStartSec, trimEndSec, canvasBrolls, signal, onLog } = opts;
  const duration = trimEndSec - trimStartSec;
  if (duration <= 0) {
    throw new Error("Duração do corte ajustado deve ser maior que zero.");
  }

  onLog?.(`[TRIM] Recortando trecho [${trimStartSec.toFixed(2)}s a ${trimEndSec.toFixed(2)}s] (${duration.toFixed(2)}s) com re-encode acelerado...`);

  const vfFilters: string[] = [];

  // Se houver overlays de CanvasBroll ativos, compõe filtros de vídeo com precisão milimétrica
  if (canvasBrolls && canvasBrolls.length > 0) {
    for (const b of canvasBrolls) {
      const relStart = b.offsetSec - trimStartSec;
      const relEnd = relStart + b.durationSec;
      if (relEnd <= 0 || relStart >= duration) continue;

      const s = Math.max(0, relStart).toFixed(2);
      const e = Math.min(duration, relEnd).toFixed(2);
      const enableExpr = `between(t\\,${s}\\,${e})`;

      const colorHex =
        b.data?.color === "green"
          ? "0x10B981"
          : b.data?.color === "yellow"
          ? "0xFFE600"
          : b.data?.color === "purple"
          ? "0xA855F7"
          : "0x00F0FF";

      const title = (b.data?.title || "DESTAQUE").replace(/[':\\]/g, "");
      const val = (b.data?.value || "+300%").replace(/[':\\]/g, "");

      // Posicionamento vertical (Safe Zone)
      const posY = b.data?.positionY === "center" ? "ih*0.48" : b.data?.positionY === "bottom" ? "ih*0.72" : "ih*0.35";

      onLog?.(`[B-ROLL CANVAS] Aplicando overlay "${title}" (${val}) no intervalo [${s}s a ${e}s]...`);

      // 1. Fundo do Card com transparência
      vfFilters.push(`drawbox=x=(w-860)/2:y=${posY}-160:w=860:h=320:color=black@0.85:t=fill:enable='${enableExpr}'`);
      // 2. Borda Neon estilizada
      vfFilters.push(`drawbox=x=(w-860)/2:y=${posY}-160:w=860:h=320:color=${colorHex}@0.9:t=6:enable='${enableExpr}'`);
      // 3. Título / Categoria
      vfFilters.push(`drawtext=text='${title}':fontcolor=0x94A3B8:fontsize=36:x=(w-text_w)/2:y=${posY}-100:enable='${enableExpr}'`);
      // 4. Métrica / Valor em destaque grande
      vfFilters.push(`drawtext=text='${val}':fontcolor=${colorHex}:fontsize=100:x=(w-text_w)/2:y=${posY}:enable='${enableExpr}'`);
    }
  }

  const args = [
    "-hide_banner", "-loglevel", "warning", "-y",
    "-threads", "1",
    "-ss", trimStartSec.toFixed(3),
    "-i", input,
    "-t", duration.toFixed(3),
  ];

  if (vfFilters.length > 0) {
    args.push("-vf", vfFilters.join(","));
  }

  args.push(
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
    "-threads", "1",
    "-x264-params", "threads=1:lookahead-threads=1:sync-lookahead=0",
    "-c:a", "aac", "-b:a", "160k",
    "-avoid_negative_ts", "make_zero",
    output
  );

  await run("ffmpeg", args, signal, onLog);
  onLog?.(`[TRIM] Re-renderização milimétrica do corte concluída.`);
}

/** Enquadramento efetivamente aplicado no render (reconstruído como Motion no Premiere/Resolve). */
export interface CutResult {
  cropX: number;
  cropKeyframes?: FaceKeyframe[];
  splitCenters?: { top: number; bottom: number };
  zoomPacingSec?: number;
}

/** Corta um trecho e já enquadra conforme a orientação, aplicando B-Rolls se houver. */
export async function cutClip(opts: {
  input: string;
  output: string;
  start: number;
  end: number;
  orientation: Orientation;
  verticalMode: VerticalMode;
  cropX: number;
  brolls?: ActiveBroll[];
  subtitlesPath?: string;
  fontsDir?: string;
  dynamicPacingSec?: number;
  colorGrade?: boolean;
  sfxEvents?: SfxEvent[];
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<CutResult> {
  const {
    input,
    output,
    start,
    end,
    orientation,
    verticalMode,
    cropX,
    brolls = [],
    subtitlesPath,
    fontsDir,
    dynamicPacingSec,
    colorGrade = false,
    sfxEvents = [],
    signal,
    onLog,
  } = opts;
  const duration = end - start;
  const result: CutResult = { cropX };

  const validBrolls = brolls.filter((b) => b.filePath && b.durationSec > 0 && b.offsetSec < duration);

  const baseInputs = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-threads", "1",
    "-filter_threads", "1",
    "-filter_complex_threads", "1",
    "-ss", start.toFixed(3),
    "-t", duration.toFixed(3),
    "-i", input,
  ];

  // Adiciona cada vídeo B-Roll como input adicional com threads limitadas
  const brollInputs: string[] = [];
  for (const b of validBrolls) {
    brollInputs.push("-threads", "1", "-stream_loop", "-1", "-i", b.filePath);
  }

  const encode = [
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-threads", "1",
    "-x264-params", "threads=1:lookahead-threads=1:sync-lookahead=0",
    ...videoRateArgs(duration),
    "-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`,
    "-avoid_negative_ts", "make_zero",
    "-movflags", "+faststart",
    output,
  ];

  const targetWidth = orientation === "vertical" ? 1080 : 1920;
  const targetHeight = orientation === "vertical" ? 1920 : 1080;

  let effectiveCropX = cropX;
  let effectiveCropExpr = `${effectiveCropX}`;
  let splitLeftX = 0.25;
  let splitRightX = 0.75;

  // Detecção e Rastreamento Facial Ativo para oradores e podcast
  if (orientation === "vertical" && (verticalMode === "face_tracking" || verticalMode === "split_face")) {
    onLog?.(`[ROSTOS IA] Mapeando oradores no trecho de ${duration.toFixed(1)}s com rastreamento temporal inteligente...`);
    const faces = await detectFacesInVideo(input, start, duration);

    if (faces.detectedCount > 0) {
      onLog?.(`[ROSTOS IA] Rastreamento temporal concluído com ${faces.detectedCount} pontos de referência.`);
    } else {
      onLog?.(`[ROSTOS IA] Nenhum rosto isolado de alto contraste; usando enquadramento balanceado.`);
    }

    if (verticalMode === "face_tracking") {
      effectiveCropX = faces.primaryCenterX;
      effectiveCropExpr = `${effectiveCropX}`;

      // Se houver keyframes com variação perceptível, monta expressão temporal de transição
      if (faces.keyframes && faces.keyframes.length > 2) {
        const distinctSteps = faces.keyframes.filter((kf, idx, arr) => {
          if (idx === 0) return true;
          return Math.abs(kf.x - arr[idx - 1].x) >= 0.03;
        });

        if (distinctSteps.length >= 2) {
          // Constrói expressão aninhada if(lt(t, t_next), x_curr, ...)
          let expr = `${distinctSteps[distinctSteps.length - 1].x}`;
          for (let k = distinctSteps.length - 2; k >= 0; k--) {
            const nextT = distinctSteps[k + 1].t.toFixed(2);
            const currX = distinctSteps[k].x.toFixed(3);
            expr = `if(lt(t\\,${nextT})\\,${currX}\\,${expr})`;
          }
          effectiveCropExpr = expr;
          result.cropKeyframes = distinctSteps.map((k) => ({ t: k.t, x: k.x }));
          onLog?.(`[ROSTOS IA] Enquadramento dinâmico ativado com ${distinctSteps.length} transições suaves.`);
        } else {
          onLog?.(`[ROSTOS IA] Câmera vertical 9:16 estabilizada no orador (X = ${(effectiveCropX * 100).toFixed(0)}%).`);
        }
      } else {
        onLog?.(`[ROSTOS IA] Câmera vertical 9:16 centralizada no orador (X = ${(effectiveCropX * 100).toFixed(0)}%).`);
      }
      result.cropX = effectiveCropX;
    } else if (verticalMode === "split_face") {
      splitLeftX = faces.leftFaceCenterX;
      splitRightX = faces.rightFaceCenterX;
      onLog?.(`[ROSTOS IA] Podcast Split: Topo no Host (X = ${(splitLeftX * 100).toFixed(0)}%), Base no Convidado (X = ${(splitRightX * 100).toFixed(0)}%).`);
    }
  }
  if (orientation === "vertical" && verticalMode === "split_face") {
    result.splitCenters = { top: splitLeftX, bottom: splitRightX };
  }

  // Filtro de corte vertical seguro com suporte a coordenadas temporais dinâmicas
  const cropVf = `crop=w=min(iw\\,ih*9/16):h=min(ih\\,iw*16/9):x='(iw-out_w)*${effectiveCropExpr}':y=(ih-out_h)/2,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2,setsar=1`;

  // 1. Gera o filtro base para o vídeo do orador (com suporte a cortes dinâmicos de câmera / punch-in zooms)
  let baseFilter = "";
  if (orientation === "horizontal") {
    baseFilter = `[0:v]scale=-2:min(1080\\,ih),setsar=1[base_v]`;
  } else if ((verticalMode === "crop" || verticalMode === "face_tracking") && dynamicPacingSec && dynamicPacingSec > 0) {
    const pSec = Math.max(1.8, Math.min(5.0, dynamicPacingSec)).toFixed(2);
    result.zoomPacingSec = Number(pSec);
    onLog?.(`[EDIÇÃO DINÂMICA] Ativando cortes de câmera / punch zoom a cada ${pSec}s (ritmo clonado da referência).`);
    baseFilter =
      `[0:v]split=2[v_wide_in][v_zoom_in];` +
      `[v_wide_in]crop=w=min(iw\\,ih*9/16):h=min(ih\\,iw*16/9):x='(iw-out_w)*${effectiveCropExpr}':y=(ih-out_h)/2,scale=1080:1920,setsar=1[w_out];` +
      `[v_zoom_in]crop=w=min(iw\\,ih*9/16)*0.82:h=min(ih\\,iw*16/9)*0.82:x='(iw-out_w)*${effectiveCropExpr}':y=(ih-out_h)/2,scale=1080:1920,setsar=1[z_out];` +
      `[w_out][z_out]overlay=enable='mod(floor(t/${pSec})\\,2)'[base_v]`;
  } else if (verticalMode === "crop" || verticalMode === "face_tracking") {
    baseFilter = `[0:v]${cropVf}[base_v]`;
  } else if (verticalMode === "split") {
    baseFilter =
      "[0:v]split=2[top_in][bot_in];" +
      "[top_in]crop=iw/2:ih:0:0,scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1[top];" +
      "[bot_in]crop=iw/2:ih:iw/2:0,scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1[bot];" +
      "[top][bot]vstack[base_v]";
  } else if (verticalMode === "split_face") {
    const cropTopX = `max(0\\,min(iw-iw*9/16\\,iw*${splitLeftX}-iw*9/32))`;
    const cropBotX = `max(0\\,min(iw-iw*9/16\\,iw*${splitRightX}-iw*9/32))`;
    baseFilter =
      "[0:v]split=2[top_in][bot_in];" +
      `[top_in]crop=w=min(iw\\,ih*9/8):h=ih:x=${cropTopX}:y=0,scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1[top];` +
      `[bot_in]crop=w=min(iw\\,ih*9/8):h=ih:x=${cropBotX}:y=0,scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1[bot];` +
      "[top][bot]vstack[base_v]";
  } else {
    // "blur"
    baseFilter =
      "[0:v]split=2[bg][fg];" +
      "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5,setsar=1[bgb];" +
      "[fg]scale=1080:-2:force_original_aspect_ratio=decrease,setsar=1[fgs];" +
      "[bgb][fgs]overlay=(W-w)/2:(H-h)/2[base_v]";
  }

  let currentLayer = "base_v";
  const filterParts = [baseFilter];

  // 2. Correção de cor e contraste viral (se solicitado)
  if (colorGrade) {
    const gradedLayer = "graded_v";
    filterParts.push(`[${currentLayer}]eq=contrast=1.12:saturation=1.20:brightness=0.01[${gradedLayer}]`);
    currentLayer = gradedLayer;
  }

  // 3. Encadeia B-rolls (se houver)
  validBrolls.forEach((b, idx) => {
    const inputIdx = idx + 1;
    const scaledBroll = `br_scale_${idx}`;
    const nextLayer = `layer_br_${idx}`;
    const tStart = b.offsetSec.toFixed(2);
    const tEnd = (b.offsetSec + b.durationSec).toFixed(2);

    filterParts.push(
      `[${inputIdx}:v]trim=duration=${b.durationSec.toFixed(2)},setpts=PTS-STARTPTS+${tStart}/TB,fps=30,scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1[${scaledBroll}]`
    );
    filterParts.push(
      `[${currentLayer}][${scaledBroll}]overlay=enable='between(t,${tStart},${tEnd})':eof_action=pass[${nextLayer}]`
    );
    currentLayer = nextLayer;
  });

  // 4. Renderização de Legendas Dinâmicas Animadas (ASS)
  if (subtitlesPath && existsSync(subtitlesPath)) {
    onLog?.(`[LEGENDAS] Queimando legendas animadas palavra por palavra no vídeo...`);
    const safeAssPath = subtitlesPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    const subbedLayer = "subbed_v";
    if (fontsDir && existsSync(fontsDir)) {
      const safeFontsDir = fontsDir.replace(/\\/g, "/").replace(/:/g, "\\:");
      filterParts.push(`[${currentLayer}]ass='${safeAssPath}':fontsdir='${safeFontsDir}'[${subbedLayer}]`);
    } else {
      filterParts.push(`[${currentLayer}]ass='${safeAssPath}'[${subbedLayer}]`);
    }
    currentLayer = subbedLayer;
  }

  // 5. Configuração e mixagem de Sound Design (SFX)
  const validSfx = sfxEvents.filter((ev) => ev.timeSec >= 0 && ev.timeSec < duration);
  const sfxInputs: string[] = [];
  let audioMapArg = "-map 0:a?";

  if (validSfx.length > 0) {
    onLog?.(`[SOUND DESIGN] Mixando ${validSfx.length} efeito(s) sonoro(s) sincronizado(s) no clipe...`);
    const sfxPaths = ensureSfxAssets();
    const sfxStartIndex = 1 + validBrolls.length;

    validSfx.forEach((ev, idx) => {
      let fPath = sfxPaths.whooshPath;
      if (ev.type === "pop") fPath = sfxPaths.popPath;
      if (ev.type === "ding") fPath = sfxPaths.dingPath;

      sfxInputs.push("-i", fPath);
      const inputIdx = sfxStartIndex + idx;
      const delayMs = Math.max(0, Math.round(ev.timeSec * 1000));
      const vol = ev.volume ?? 0.35;
      filterParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${vol}[sfx_a_${idx}]`);
    });

    const mixInputs = [`[0:a]`];
    for (let i = 0; i < validSfx.length; i++) {
      mixInputs.push(`[sfx_a_${i}]`);
    }
    filterParts.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2[final_a]`);
    audioMapArg = "-map [final_a]";
  }

  // Se não houver B-rolls, nem grading, nem legendas, nem zoom, nem SFX, atalho simples:
  if (!validBrolls.length && !colorGrade && !subtitlesPath && (!dynamicPacingSec || dynamicPacingSec <= 0) && !validSfx.length) {
    if (orientation === "horizontal") {
      await run("ffmpeg", [...baseInputs, "-vf", "scale=-2:min(1080\\,ih),setsar=1", ...encode], signal, onLog);
      return result;
    }
    if (verticalMode === "crop" || verticalMode === "face_tracking") {
      await run("ffmpeg", [...baseInputs, "-vf", cropVf, ...encode], signal, onLog);
      return result;
    }
  }

  const fullFilter = filterParts.join(";");
  const audioMapArgs = audioMapArg === "-map [final_a]" ? ["-map", "[final_a]"] : ["-map", "0:a?"];

  try {
    await run("ffmpeg", [...baseInputs, ...brollInputs, ...sfxInputs, "-filter_complex", fullFilter, "-map", `[${currentLayer}]`, ...audioMapArgs, ...encode], signal, onLog);
  } catch (err: any) {
    if (signal?.aborted) throw err;
    onLog?.(`[AVISO] Renderização com efeitos avançados encontrou instabilidade (${err?.message}). Ativando modo de segurança compatível...`);
    const fallbackVf = orientation === "horizontal"
      ? "scale=-2:min(1080\\,ih),setsar=1"
      : cropVf;
    await run("ffmpeg", [...baseInputs, "-vf", fallbackVf, "-map", "0:v:0", "-map", "0:a?", ...encode], signal, onLog);
    onLog?.(`[SUCESSO] Clipe renderizado e protegido via modo compatível.`);
  }

  return result;
}

/** Duração do vídeo em segundos (usa o ffprobe, que vem junto com o ffmpeg). */
export function probeDuration(file: string): Promise<number> {
  const isHttp = /^https?:\/\//i.test(file);
  const extraArgs = isHttp ? ["-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"] : [];
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      ["-v", "error", ...extraArgs, "-show_entries", "format=duration", "-of", "csv=p=0", file],
      (err, stdout) => {
        if (err) return reject(new Error(`ffprobe falhou: ${err.message}`));
        const n = parseFloat(stdout.trim());
        Number.isFinite(n) ? resolve(n) : reject(new Error("Não consegui ler a duração do vídeo"));
      }
    );
  });
}

/** Frame rates padrão de broadcast/cinema. Valores "estranhos" do ffprobe são encaixados no mais próximo. */
const STANDARD_RATES: [number, number][] = [
  [24000, 1001], [24, 1], [25, 1], [30000, 1001], [30, 1],
  [48, 1], [50, 1], [60000, 1001], [60, 1],
];

function parseRate(s: string | undefined): number {
  if (!s) return 0;
  const [n, d] = s.split("/").map(Number);
  if (!d) return Number.isFinite(n) ? n : 0;
  return n / d;
}

function snapRate(fps: number): [number, number] {
  if (!(fps > 0)) return [30, 1];
  let best = STANDARD_RATES[0];
  let bestDiff = Infinity;
  for (const r of STANDARD_RATES) {
    const diff = Math.abs(r[0] / r[1] - fps);
    if (diff < bestDiff) { best = r; bestDiff = diff; }
  }
  return bestDiff < 0.05 ? best : [Math.max(1, Math.round(fps)), 1];
}

/**
 * Metadados técnicos completos do arquivo (fps exato, resolução, timecode, áudio).
 * Necessários para que a timeline exportada (XML/EDL) bata frame a frame e reconecte na mídia original.
 */
export function probeSource(file: string, fileName: string): Promise<import("./types.js").SourceMeta> {
  const isHttp = /^https?:\/\//i.test(file);
  const extraArgs = isHttp ? ["-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"] : [];
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      ["-v", "error", ...extraArgs, "-print_format", "json", "-show_streams", "-show_format", file],
      { maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(new Error(`ffprobe falhou: ${err.message}`));
        try {
          const data = JSON.parse(stdout);
          const streams: any[] = data.streams ?? [];
          const v = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
          const a = streams.find((s) => s.codec_type === "audio");
          const r = parseRate(v?.r_frame_rate);
          const avg = parseRate(v?.avg_frame_rate);
          // r_frame_rate às vezes vem 90000/1 ou 120/1 em VFR: prefira a média quando forem muito diferentes.
          const vfr = r > 0 && avg > 0 && Math.abs(r - avg) / r > 0.02;
          const [fpsNum, fpsDen] = snapRate(vfr ? avg : r || avg);

          let width = Number(v?.width ?? 1920);
          let height = Number(v?.height ?? 1080);
          const rotation = Number(
            v?.tags?.rotate ?? v?.side_data_list?.find((sd: any) => sd.rotation !== undefined)?.rotation ?? 0
          );
          if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];

          const tc =
            v?.tags?.timecode ??
            data.format?.tags?.timecode ??
            streams.find((s) => s.tags?.timecode)?.tags?.timecode ??
            null;

          resolve({
            fileName,
            durationSec: Number(data.format?.duration ?? v?.duration ?? 0),
            fpsNum,
            fpsDen,
            width,
            height,
            startTimecode: typeof tc === "string" && /^\d{2}:\d{2}:\d{2}[:;.]\d{2}$/.test(tc) ? tc : null,
            audioChannels: Number(a?.channels ?? 0),
            audioSampleRate: Number(a?.sample_rate ?? 48000),
            videoCodec: v?.codec_name ?? null,
            vfr,
          });
        } catch (e) {
          reject(new Error(`ffprobe: saída inválida (${(e as Error).message})`));
        }
      }
    );
  });
}
