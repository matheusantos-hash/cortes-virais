import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SfxEvent {
  timeSec: number;
  type: "whoosh" | "pop" | "ding";
  volume?: number; // 0.0 a 1.0 (default: 0.35)
}

/**
 * Cria o cabeçalho padrão de 44 bytes para um arquivo WAV PCM 16-bit Mono 44100Hz
 */
function createWavHeader(numSamples: number, sampleRate = 44100): Buffer {
  const byteRate = sampleRate * 2; // 1 canal * 2 bytes por sample
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44);

  // RIFF Chunk
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

/**
 * Gera um efeito sonoro cinematográfico de "Whoosh" (transição/vento rápido)
 */
function generateWhooshBuffer(): Buffer {
  const sampleRate = 44100;
  const durationSec = 0.35;
  const numSamples = Math.floor(sampleRate * durationSec);
  const header = createWavHeader(numSamples, sampleRate);
  const data = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durationSec;
    // Envelope em curva seno para entrada e saída suave
    const env = Math.sin(Math.PI * progress);
    // Vento / ruído branco modulado por frequência média com modulação dinâmica
    const whiteNoise = (Math.random() * 2 - 1);
    const sweepTone = Math.sin(2 * Math.PI * (250 + 600 * Math.sin(Math.PI * progress)) * t);
    const sample = (whiteNoise * 0.65 + sweepTone * 0.35) * env * 0.7;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    data.writeInt16LE(intSample, i * 2);
  }

  return Buffer.concat([header, data]);
}

/**
 * Gera um efeito sonoro de "Pop" crocante (aparição de palavra/emoji)
 */
function generatePopBuffer(): Buffer {
  const sampleRate = 44100;
  const durationSec = 0.10;
  const numSamples = Math.floor(sampleRate * durationSec);
  const header = createWavHeader(numSamples, sampleRate);
  const data = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durationSec;
    // Queda exponencial rápida de frequência (pitch drop)
    const freq = 650 * Math.exp(-22 * t) + 120;
    const env = Math.exp(-25 * progress);
    const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.85;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    data.writeInt16LE(intSample, i * 2);
  }

  return Buffer.concat([header, data]);
}

/**
 * Gera um efeito sonoro de "Ding" cristalino (gancho / momento viral)
 */
function generateDingBuffer(): Buffer {
  const sampleRate = 44100;
  const durationSec = 0.65;
  const numSamples = Math.floor(sampleRate * durationSec);
  const header = createWavHeader(numSamples, sampleRate);
  const data = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durationSec;
    // Decaimento suave de sino
    const env = Math.exp(-6.5 * progress);
    // Harmônicos cristalinos
    const h1 = Math.sin(2 * Math.PI * 2200 * t);
    const h2 = Math.sin(2 * Math.PI * 4400 * t) * 0.4;
    const h3 = Math.sin(2 * Math.PI * 6600 * t) * 0.15;
    const sample = (h1 + h2 + h3) * env * 0.6;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    data.writeInt16LE(intSample, i * 2);
  }

  return Buffer.concat([header, data]);
}

/**
 * Garante que a pasta de efeitos sonoros exista com os arquivos prontos
 */
export function ensureSfxAssets(): { whooshPath: string; popPath: string; dingPath: string } {
  const assetsDir = path.resolve(__dirname, "..", "assets", "sfx");
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }

  const whooshPath = path.join(assetsDir, "whoosh.wav");
  const popPath = path.join(assetsDir, "pop.wav");
  const dingPath = path.join(assetsDir, "ding.wav");

  if (!existsSync(whooshPath)) {
    writeFileSync(whooshPath, generateWhooshBuffer());
  }
  if (!existsSync(popPath)) {
    writeFileSync(popPath, generatePopBuffer());
  }
  if (!existsSync(dingPath)) {
    writeFileSync(dingPath, generateDingBuffer());
  }

  return { whooshPath, popPath, dingPath };
}
