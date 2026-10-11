/**
 * Módulo de Extração de Áudio Client-Side (Navegador)
 * 
 * Extrai a faixa de áudio de arquivos de vídeo locais (.mp4, .mov, .mkv, .webm)
 * convertendo diretamente para WAV 16kHz Mono (formato ideal para Deepgram/Whisper).
 * 
 * Abordagem em 2 camadas (Progressive Fallback):
 * 1. Web Audio API nativa com OfflineAudioContext (rápido, zero dependências extras).
 * 2. Fallback dinâmico para FFmpeg WASM caso o container/codec de áudio
 *    não seja decodificado nativamente pelo navegador (ex: MKV com AC3).
 */

export interface AudioExtractionProgress {
  stage: "reading" | "decoding" | "resampling" | "encoding" | "ffmpeg_fallback" | "done";
  percent: number;
  message: string;
}

/**
 * Codifica amostras de Float32 em um buffer de arquivo WAV 16-bit PCM Mono padrão RIFF.
 */
function encodeWavPcm16Mono(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const bytesPerSample = 2; // 16-bit = 2 bytes
  const blockAlign = 1 * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper para escrever strings ASCII
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // Cabeçalho RIFF
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // Tamanho total do arquivo - 8
  writeString(8, "WAVE");

  // Sub-chunk "fmt " (formato do áudio)
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Tamanho do subchunk (16 para PCM)
  view.setUint16(20, 1, true); // Áudio format 1 = PCM linear
  view.setUint16(22, 1, true); // Número de canais = 1 (Mono)
  view.setUint32(24, sampleRate, true); // Taxa de amostragem (ex: 16000)
  view.setUint32(28, byteRate, true); // Taxa de bytes por segundo
  view.setUint16(32, blockAlign, true); // Alinhamento de bloco
  view.setUint16(34, 16, true); // Bits por amostra = 16

  // Sub-chunk "data"
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Escreve os samples quantizados para 16-bit inteiros (-32768 a 32767)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Clamping para evitar distorção/overflow
    const s = Math.max(-1, Math.min(1, samples[i]));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Extrai áudio usando a Web Audio API nativa.
 */
async function extractViaWebAudio(
  file: File,
  onProgress?: (p: AudioExtractionProgress) => void
): Promise<{ audioBlob: Blob; durationSec: number; format: "wav" }> {
  onProgress?.({
    stage: "reading",
    percent: 10,
    message: "Lendo arquivo de vídeo localmente...",
  });

  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({
    stage: "decoding",
    percent: 35,
    message: "Decodificando trilha de áudio...",
  });

  // Cria um AudioContext temporário para decodificar o container de mídia
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) {
    throw new Error("Web Audio API não suportada neste navegador.");
  }

  const tempCtx = new AudioCtxClass();
  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
  } finally {
    try {
      await tempCtx.close();
    } catch {}
  }

  const durationSec = decodedBuffer.duration;
  const targetSampleRate = 16000;

  onProgress?.({
    stage: "resampling",
    percent: 70,
    message: `Otimizando áudio para IA (16kHz Mono | ${Math.round(durationSec)}s)...`,
  });

  // Reamostragem de alta fidelidade usando OfflineAudioContext
  const totalTargetSamples = Math.ceil(durationSec * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, totalTargetSamples, targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;

  // Se o áudio original for estéreo/multicanal, o OfflineAudioContext mono faz a mixagem perfeita
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const monoSamples = renderedBuffer.getChannelData(0);

  onProgress?.({
    stage: "encoding",
    percent: 90,
    message: "Gerando arquivo de áudio compacto para envio...",
  });

  const wavArrayBuffer = encodeWavPcm16Mono(monoSamples, targetSampleRate);
  const audioBlob = new Blob([wavArrayBuffer], { type: "audio/wav" });

  onProgress?.({
    stage: "done",
    percent: 100,
    message: "Áudio extraído com sucesso!",
  });

  return {
    audioBlob,
    durationSec,
    format: "wav",
  };
}

/**
 * Fallback para FFmpeg WASM caso a Web Audio API nativa não consiga decodificar o vídeo.
 */
async function extractViaFfmpegWasm(
  file: File,
  onProgress?: (p: AudioExtractionProgress) => void
): Promise<{ audioBlob: Blob; durationSec: number; format: "wav" }> {
  onProgress?.({
    stage: "ffmpeg_fallback",
    percent: 20,
    message: "Carregando módulo FFmpeg WASM para decodificação universal...",
  });

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();

  // Carrega a versão single-thread estável do core (evita problemas com COOP/COEP)
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  const ffmpegBaseURL = "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm";
  await ffmpeg.load({
    classWorkerURL: await toBlobURL(`${ffmpegBaseURL}/worker.js`, "text/javascript"),
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  onProgress?.({
    stage: "ffmpeg_fallback",
    percent: 50,
    message: "Carregando mídia no FFmpeg virtual...",
  });

  const inputExt = file.name.split(".").pop() || "mp4";
  const inputName = `input.${inputExt}`;
  const outputName = "output.wav";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onProgress?.({
    stage: "ffmpeg_fallback",
    percent: 70,
    message: "Extraindo áudio a 16kHz mono via FFmpeg...",
  });

  // Extrai apenas o áudio, converte para 16kHz mono WAV pcm 16-bit
  await ffmpeg.exec(["-i", inputName, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outputName]);

  const data = await ffmpeg.readFile(outputName);
  const audioBytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const audioBlob = new Blob([audioBytes as any], { type: "audio/wav" });

  // Limpa arquivos do FS virtual
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch {}

  onProgress?.({
    stage: "done",
    percent: 100,
    message: "Áudio extraído via FFmpeg com sucesso!",
  });

  return {
    audioBlob,
    durationSec: 0, // calculado pelo backend/probe
    format: "wav",
  };
}

/**
 * Função principal para extração de áudio client-side.
 * Tenta Web Audio API primeiro; se falhar, aciona FFmpeg WASM de forma transparente.
 */
export async function extractAudioFromVideoFile(
  file: File,
  onProgress?: (p: AudioExtractionProgress) => void
): Promise<{ audioBlob: Blob; durationSec: number; format: "wav" }> {
  try {
    return await extractViaWebAudio(file, onProgress);
  } catch (err: any) {
    console.warn("Web Audio API falhou ao decodificar (possível formato incomum). Usando fallback FFmpeg WASM:", err);
    return await extractViaFfmpegWasm(file, onProgress);
  }
}
