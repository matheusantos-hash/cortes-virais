/**
 * Módulo de Fatiamento Local de Vídeo (Client-Side Video Slicing)
 * 
 * Executa o corte ultra-rápido dos clipes selecionados pela IA diretamente no computador do usuário
 * utilizando FFmpeg WASM com stream copy (-c copy).
 * 
 * Vantagens:
 * - Zero recodificação de vídeo (instantâneo: ~1s por corte de 1 minuto).
 * - Não consome CPU pesada de renderização.
 * - Evita o upload do vídeo bruto inteiro de gigabytes.
 */

export interface CutSegment {
  id: string;
  position: number;
  startSeconds: number;
  endSeconds: number;
  title?: string;
}

export interface CutResult {
  id: string;
  position: number;
  file: File;
  blob: Blob;
  sizeBytes: number;
  durationSeconds: number;
}

export interface CutProgress {
  current: number;
  total: number;
  clipTitle: string;
  percent: number;
  statusMessage: string;
}

export async function sliceVideoLocally(
  sourceFile: File,
  segments: CutSegment[],
  onProgress?: (progress: CutProgress) => void
): Promise<CutResult[]> {
  if (!segments || segments.length === 0) return [];

  onProgress?.({
    current: 0,
    total: segments.length,
    clipTitle: "",
    percent: 5,
    statusMessage: "Inicializando motor de corte no navegador (FFmpeg WASM)...",
  });

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();

  // Carrega a versão single-thread estável do core (não requer COOP/COEP especiais)
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  const ffmpegBaseURL = "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm";
  await ffmpeg.load({
    classWorkerURL: await toBlobURL(`${ffmpegBaseURL}/worker.js`, "text/javascript"),
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  onProgress?.({
    current: 0,
    total: segments.length,
    clipTitle: "",
    percent: 15,
    statusMessage: "Mapeando arquivo de vídeo original localmente...",
  });

  const ext = sourceFile.name.split(".").pop() || "mp4";
  const inputFileName = `source_input.${ext}`;

  await ffmpeg.writeFile(inputFileName, await fetchFile(sourceFile));

  const results: CutResult[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const duration = Math.max(1, seg.endSeconds - seg.startSeconds);
    const outputFileName = `cut_${String(seg.position).padStart(2, "0")}.mp4`;

    const progressPct = Math.round(15 + ((i + 0.5) / segments.length) * 80);
    onProgress?.({
      current: i + 1,
      total: segments.length,
      clipTitle: seg.title || `Corte #${seg.position}`,
      percent: progressPct,
      statusMessage: `Fatiando Corte ${i + 1}/${segments.length}: ${seg.title || ""} (${duration.toFixed(0)}s)...`,
    });

    // Fatiamento ultra-rápido via Stream Copy (-c copy)
    // -avoid_negative_ts make_zero garante que os timestamps iniciem em 00:00 sem frames pretos
    const args = [
      "-ss",
      seg.startSeconds.toFixed(3),
      "-to",
      seg.endSeconds.toFixed(3),
      "-i",
      inputFileName,
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      outputFileName,
    ];

    await ffmpeg.exec(args);

    const rawData = await ffmpeg.readFile(outputFileName);
    const bytes = typeof rawData === "string" ? new TextEncoder().encode(rawData) : rawData;
    const blob = new Blob([bytes as any], { type: "video/mp4" });
    const clipName = `clip-${String(seg.position).padStart(2, "0")}.mp4`;
    const cutFile = new File([blob], clipName, { type: "video/mp4" });

    results.push({
      id: seg.id,
      position: seg.position,
      file: cutFile,
      blob,
      sizeBytes: blob.size,
      durationSeconds: duration,
    });

    // Libera a memória virtual do clipe fatiado
    try {
      await ffmpeg.deleteFile(outputFileName);
    } catch {}
  }

  // Libera o arquivo fonte da memória virtual do FFmpeg
  try {
    await ffmpeg.deleteFile(inputFileName);
  } catch {}

  onProgress?.({
    current: segments.length,
    total: segments.length,
    clipTitle: "Concluído",
    percent: 100,
    statusMessage: "Todos os clipes foram fatiados com sucesso!",
  });

  return results;
}
