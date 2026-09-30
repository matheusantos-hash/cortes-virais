import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Orientation, VerticalMode } from "./types.js";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("error", (err) =>
      reject(new Error(`Não consegui executar "${cmd}". Ele está instalado e no PATH? (${err.message})`))
    );
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} terminou com código ${code}`))
    );
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
export async function tryDirectDownload(url: string, dest: string): Promise<DirectResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000); // só para receber os cabeçalhos
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (cortes-virais-worker)" },
    });
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

  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest));
  return "ok";
}

/** Baixa o vídeo de um link (YouTube etc.) em MP4, até 1080p. */
export async function downloadVideo(url: string, outPath: string): Promise<void> {
  await run("yt-dlp", [
    "-f",
    "bv*[height<=1080]+ba/b[height<=1080]",
    "--merge-output-format",
    "mp4",
    "-o",
    outPath,
    url,
  ]);
}

/** Extrai só o áudio (mono, leve) para mandar à transcrição. */
export async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", videoPath,
    "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k",
    audioPath,
  ]);
}

/** Corta um trecho e já enquadra conforme a orientação. */
export async function cutClip(opts: {
  input: string;
  output: string;
  start: number;
  end: number;
  orientation: Orientation;
  verticalMode: VerticalMode;
  cropX: number;
}): Promise<void> {
  const { input, output, start, end, orientation, verticalMode, cropX } = opts;
  const duration = end - start;

  const base = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", start.toFixed(3),
    "-i", input,
    "-t", duration.toFixed(3),
  ];
  const encode = [
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    ...videoRateArgs(duration),
    "-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`,
    "-movflags", "+faststart",
    output,
  ];

  if (orientation === "horizontal") {
    await run("ffmpeg", [...base, "-vf", "scale=-2:min(1080\\,ih)", ...encode]);
    return;
  }

  if (verticalMode === "crop") {
    // Preenche o quadro 9:16 cortando as laterais. cropX: 0 = esquerda, 0.5 = centro, 1 = direita.
    const vf = `crop=ih*9/16:ih:(iw-ow)*${cropX}:0,scale=1080:1920`;
    await run("ffmpeg", [...base, "-vf", vf, ...encode]);
    return;
  }

  // "blur": vídeo inteiro centralizado sobre um fundo desfocado 9:16.
  const filter =
    "[0:v]split=2[bg][fg];" +
    "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bgb];" +
    "[fg]scale=1080:-2[fgs];" +
    "[bgb][fgs]overlay=(W-w)/2:(H-h)/2[v]";
  await run("ffmpeg", [...base, "-filter_complex", filter, "-map", "[v]", "-map", "0:a?", ...encode]);
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
