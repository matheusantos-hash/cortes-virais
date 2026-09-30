import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Orientation, VerticalMode } from "./types.js";

export class CanceledError extends Error {
  constructor(message = "Processamento cancelado pelo usuário.") {
    super(message);
    this.name = "CanceledError";
  }
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

    p.on("close", (code) => {
      if (signal) signal.removeEventListener("abort", handleAbort);
      if (signal?.aborted) {
        reject(new CanceledError());
      } else if (code === 0) {
        resolve();
      } else {
        const fullErr = stderrChunks.join("").trim();
        const lastLines = fullErr.split("\n").filter(Boolean).slice(-3).join(" | ");
        reject(new Error(`${cmd} terminou com código ${code}${lastLines ? `: ${lastLines}` : ""}`));
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

  const maxGb = Number(process.env.MAX_DOWNLOAD_GB ?? 4);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > maxGb * 1024 ** 3) {
    await res.body.cancel().catch(() => {});
    return "too-large";
  }

  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest), { signal });
  return "ok";
}

/** Baixa o vídeo de um link (YouTube etc.) em MP4, até 1080p. */
export async function downloadVideo(url: string, outPath: string, signal?: AbortSignal, onLog?: (line: string) => void): Promise<void> {
  await run(
    "yt-dlp",
    [
      "-f",
      "bv*[height<=1080]+ba/b[height<=1080]",
      "--merge-output-format",
      "mp4",
      "-o",
      outPath,
      url,
    ],
    signal,
    onLog
  );
}

/** Extrai só o áudio (mono, leve) para mandar à transcrição. */
export async function extractAudio(videoPath: string, audioPath: string, signal?: AbortSignal, onLog?: (line: string) => void): Promise<void> {
  await run(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", videoPath,
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k",
      audioPath,
    ],
    signal,
    onLog
  );
}

export interface ActiveBroll {
  offsetSec: number;
  durationSec: number;
  filePath: string;
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
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<void> {
  const { input, output, start, end, orientation, verticalMode, cropX, brolls = [], signal, onLog } = opts;
  const duration = end - start;

  const validBrolls = brolls.filter((b) => b.filePath && b.durationSec > 0 && b.offsetSec < duration);

  const baseInputs = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", start.toFixed(3),
    "-t", duration.toFixed(3),
    "-i", input,
  ];

  // Adiciona cada vídeo B-Roll como input adicional
  const brollInputs: string[] = [];
  for (const b of validBrolls) {
    brollInputs.push("-stream_loop", "-1", "-i", b.filePath);
  }

  const encode = [
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    ...videoRateArgs(duration),
    "-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`,
    "-avoid_negative_ts", "make_zero",
    "-movflags", "+faststart",
    output,
  ];

  const targetWidth = orientation === "vertical" ? 1080 : 1920;
  const targetHeight = orientation === "vertical" ? 1920 : 1080;

  // Filtro de corte vertical seguro (funciona para qualquer proporção de entrada sem estourar dimensões)
  const cropVf = `crop=w=min(iw\\,ih*9/16):h=min(ih\\,iw*16/9):x=(iw-out_w)*${cropX}:y=(ih-out_h)/2,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2,setsar=1`;

  // 1. Gera o filtro base para o vídeo do orador
  let baseFilter = "";
  if (orientation === "horizontal") {
    baseFilter = `[0:v]scale=-2:min(1080\\,ih),setsar=1[base_v]`;
  } else if (verticalMode === "crop") {
    baseFilter = `[0:v]${cropVf}[base_v]`;
  } else if (verticalMode === "split") {
    baseFilter =
      "[0:v]split=2[top_in][bot_in];" +
      "[top_in]crop=iw/2:ih:0:0,scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1[top];" +
      "[bot_in]crop=iw/2:ih:iw/2:0,scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1[bot];" +
      "[top][bot]vstack[base_v]";
  } else {
    // "blur"
    baseFilter =
      "[0:v]split=2[bg][fg];" +
      "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5,setsar=1[bgb];" +
      "[fg]scale=1080:-2:force_original_aspect_ratio=decrease,setsar=1[fgs];" +
      "[bgb][fgs]overlay=(W-w)/2:(H-h)/2[base_v]";
  }

  // Se não houver B-rolls, executa diretamente com -vf (mais rápido e sem conflito de streams)
  if (!validBrolls.length) {
    if (orientation === "horizontal") {
      await run("ffmpeg", [...baseInputs, "-vf", "scale=-2:min(1080\\,ih),setsar=1", ...encode], signal, onLog);
      return;
    }
    if (verticalMode === "crop") {
      await run("ffmpeg", [...baseInputs, "-vf", cropVf, ...encode], signal, onLog);
      return;
    }
    await run("ffmpeg", [...baseInputs, "-filter_complex", baseFilter, "-map", "[base_v]", "-map", "0:a?", ...encode], signal, onLog);
    return;
  }

  // 2. Encadeia os B-rolls sobre o [base_v]
  let currentLayer = "base_v";
  const filterParts = [baseFilter];

  validBrolls.forEach((b, idx) => {
    const inputIdx = idx + 1;
    const scaledBroll = `br_scale_${idx}`;
    const nextLayer = idx === validBrolls.length - 1 ? "final_v" : `layer_${idx}`;
    const tStart = b.offsetSec.toFixed(2);
    const tEnd = (b.offsetSec + b.durationSec).toFixed(2);

    filterParts.push(`[${inputIdx}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1[${scaledBroll}]`);
    filterParts.push(`[${currentLayer}][${scaledBroll}]overlay=enable='between(t,${tStart},${tEnd})':format=auto[${nextLayer}]`);
    currentLayer = nextLayer;
  });

  const fullFilter = filterParts.join(";");
  await run("ffmpeg", [...baseInputs, ...brollInputs, "-filter_complex", fullFilter, "-map", `[${currentLayer}]`, "-map", "0:a?", ...encode], signal, onLog);
}

/** Duração do vídeo em segundos (usa o ffprobe, que vem junto com o ffmpeg). */
export function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      (err, stdout) => {
        if (err) return reject(new Error(`ffprobe falhou: ${err.message}`));
        const n = parseFloat(stdout.trim());
        Number.isFinite(n) ? resolve(n) : reject(new Error("Não consegui ler a duração do vídeo"));
      }
    );
  });
}
