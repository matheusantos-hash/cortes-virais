import { readFile } from "node:fs/promises";
import type { Word } from "./types.js";
import { transcribeWithGemini, type AudioTag } from "./gemini_transcribe.js";
import { probeDuration } from "./media.js";

export type TranscriptionProvider = "deepgram" | "gemini" | "auto";

export interface TranscribeResult {
  words: Word[];
  audioTags?: AudioTag[];
  usedProvider: "deepgram" | "gemini";
}

/**
 * Transcreve diretamente via Deepgram Nova-3.
 */
async function transcribeDeepgram(audioPath: string, language: string, onLog?: (msg: string) => void): Promise<Word[]> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("Falta DEEPGRAM_API_KEY no .env");

  onLog?.(`[DEEPGRAM] Enviando áudio para transcrição (Nova-3, idioma: ${language})...`);

  const params = new URLSearchParams({
    model: process.env.DEEPGRAM_MODEL ?? "nova-3",
    language,
    smart_format: "true",
    punctuate: "true",
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "audio/mpeg",
    },
    body: await readFile(audioPath),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Deepgram retornou status ${res.status}: ${errorText}`);
  }

  const json: any = await res.json();
  const words: Word[] | undefined = json?.results?.channels?.[0]?.alternatives?.[0]?.words;
  if (!words?.length) {
    throw new Error("O Deepgram não devolveu palavras. O áudio tem fala audível?");
  }

  onLog?.(`[DEEPGRAM] Transcrição concluída: ${words.length} palavras identificadas com alta precisão.`);
  return words;
}

/**
 * Transcrição flexível e resiliente com suporte a Deepgram, Gemini Pro e Fallback Automático.
 */
export async function transcribeAudio(params: {
  audioPath: string;
  language: string;
  provider?: TranscriptionProvider;
  onLog?: (msg: string) => void;
}): Promise<TranscribeResult> {
  const { audioPath, language, provider = "auto", onLog } = params;
  const audioDuration = await probeDuration(audioPath).catch(() => 0);
  const isLongAudio = audioDuration > 600; // > 10 minutos

  // 1. Escolha explícita do Gemini Pro
  if (provider === "gemini") {
    if (isLongAudio && process.env.DEEPGRAM_API_KEY) {
      onLog?.(
        `[OTIMIZAÇÃO ÁUDIO LONGO] Áudio de ${Math.round(audioDuration / 60)} min detectado. O Gemini Pro possui teto de tokens de saída para JSON de palavras. Redirecionando com segurança para Deepgram Nova-3 para garantir transcrição 100% completa.`
      );
      try {
        const words = await transcribeDeepgram(audioPath, language, onLog);
        return { words, usedProvider: "deepgram" };
      } catch (err: any) {
        onLog?.(`[AVISO] Deepgram falhou (${err?.message}). Retornando para Gemini Pro com auto-recuperação de tokens...`);
      }
    } else {
      onLog?.("[MOTOR TRANSCRIÇÃO] Usuário selecionou Gemini Pro como motor de transcrição.");
    }
    const result = await transcribeWithGemini(audioPath, language, onLog);
    return {
      words: result.words,
      audioTags: result.audioTags,
      usedProvider: "gemini",
    };
  }

  // 2. Escolha explícita do Deepgram
  if (provider === "deepgram") {
    try {
      const words = await transcribeDeepgram(audioPath, language, onLog);
      return { words, usedProvider: "deepgram" };
    } catch (err: any) {
      // Se falhar e tiver chave do Gemini, aciona fallback para não perder o job do usuário
      if (process.env.GEMINI_API_KEY) {
        onLog?.(`[AVISO] Deepgram falhou (${err?.message || "erro"}). Ativando fallback emergencial para Gemini Pro...`);
        const geminiResult = await transcribeWithGemini(audioPath, language, onLog);
        return {
          words: geminiResult.words,
          audioTags: geminiResult.audioTags,
          usedProvider: "gemini",
        };
      }
      throw err;
    }
  }

  // 3. Modo 'auto': Prioriza Deepgram se tiver chave, com fallback automático no Gemini Pro
  if (process.env.DEEPGRAM_API_KEY) {
    try {
      const words = await transcribeDeepgram(audioPath, language, onLog);
      return { words, usedProvider: "deepgram" };
    } catch (err: any) {
      onLog?.(`[FALLBACK INTELIGENTE] Deepgram indisponível (${err?.message || "cota/conexão"}). Alternando para o Google Gemini Pro...`);
      if (!process.env.GEMINI_API_KEY) {
        throw new Error(`Falha no Deepgram (${err?.message}) e GEMINI_API_KEY não configurada para fallback.`);
      }
      const geminiResult = await transcribeWithGemini(audioPath, language, onLog);
      return {
        words: geminiResult.words,
        audioTags: geminiResult.audioTags,
        usedProvider: "gemini",
      };
    }
  }

  // Se não tem Deepgram, mas tem Gemini
  if (process.env.GEMINI_API_KEY) {
    onLog?.("[MOTOR TRANSCRIÇÃO] DEEPGRAM_API_KEY não encontrada. Utilizando Gemini Pro como motor primário.");
    const geminiResult = await transcribeWithGemini(audioPath, language, onLog);
    return {
      words: geminiResult.words,
      audioTags: geminiResult.audioTags,
      usedProvider: "gemini",
    };
  }

  throw new Error("Nenhum motor de transcrição disponível. Configure DEEPGRAM_API_KEY ou GEMINI_API_KEY no arquivo .env.");
}

/** Compatibilidade legada para chamadas diretas anteriores. */
export async function transcribe(audioPath: string, language: string): Promise<Word[]> {
  const res = await transcribeAudio({ audioPath, language, provider: "auto" });
  return res.words;
}
