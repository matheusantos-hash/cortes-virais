import { GoogleGenAI } from "@google/genai";
import { existsSync } from "node:fs";
import type { Word } from "./types.js";

export interface AudioTag {
  time: number;
  tag: string;
  description: string;
}

export interface GeminiTranscriptionResult {
  words: Word[];
  audioTags?: AudioTag[];
}

/**
 * Aguarda o arquivo processar no Google AI Files se necessário.
 */
async function waitForActiveFile(ai: GoogleGenAI, fileName: string, maxWaitMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const file = await ai.files.get({ name: fileName });
    if (file.state === "ACTIVE") return;
    if (file.state === "FAILED") throw new Error(`Processamento do arquivo falhou no Gemini: ${fileName}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/**
 * Transcreve áudio com timestamps milimétricos e extrai tags de áudio usando o Google Gemini Pro.
 */
export async function transcribeWithGemini(
  audioPath: string,
  language: string,
  onLog?: (msg: string) => void
): Promise<GeminiTranscriptionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY no arquivo .env");
  }

  if (!existsSync(audioPath)) {
    throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  onLog?.(`[GEMINI PRO] Iniciando upload e preparação de áudio para o modelo ${model}...`);

  let uploadedFileName: string | null = null;
  try {
    // Upload do áudio usando Files API do Google GenAI
    const uploadResult = await ai.files.upload({
      file: audioPath,
      config: {
        mimeType: "audio/mp3",
      },
    });

    uploadedFileName = uploadResult.name ?? null;
    if (!uploadedFileName) {
      throw new Error("Falha ao obter identificador do arquivo no Gemini.");
    }

    onLog?.(`[GEMINI PRO] Áudio enviado com sucesso (ID: ${uploadedFileName}). Aguardando validação...`);

    if (uploadResult.state && uploadResult.state !== "ACTIVE") {
      await waitForActiveFile(ai, uploadedFileName);
    }

    onLog?.(`[GEMINI PRO] Áudio pronto. Executando transcrição milimétrica e análise de tags emocionais/sonoras...`);

    const prompt = `Você é um motor de transcrição profissional de áudio com precisão milimétrica e especialista em análise multimodal de áudio.
Idioma do áudio: ${language}.

Sua missão:
1. Transcreva com máxima fidelidade todas as palavras faladas, atribuindo o tempo exato de início e fim em segundos para CADA palavra (start e end).
2. Detecte eventos sonoros e emoções vocais marcantes (risos, aplausos, suspiros, gritos, mudança brusca de tom, música de fundo, silêncio tenso) com a minutagem exata em 'audio_tags'.

Responda ESTRITAMENTE em formato JSON puro, sem crases de código markdown e sem comentários adicionais:
{
  "words": [
    { "word": "palavra", "punctuated_word": "Palavra,", "start": 0.12, "end": 0.45 }
  ],
  "audio_tags": [
    { "time": 14.5, "tag": "risos", "description": "Gargalhada do entrevistador" }
  ]
}`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: uploadResult.uri,
                mimeType: uploadResult.mimeType || "audio/mp3",
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text?.trim() || "";
    if (!responseText) {
      throw new Error("Gemini retornou uma resposta vazia para o áudio.");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Limpeza de possíveis blocos markdown se existirem
      const clean = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      parsed = JSON.parse(clean);
    }

    const words: Word[] = Array.isArray(parsed.words)
      ? parsed.words.map((w: any) => ({
          word: String(w.word || "").trim(),
          punctuated_word: w.punctuated_word ? String(w.punctuated_word).trim() : String(w.word || "").trim(),
          start: Number(w.start || 0),
          end: Number(w.end || 0),
        }))
      : [];

    if (!words.length) {
      throw new Error("O Gemini não identificou palavras faladas no áudio fornecido.");
    }

    const audioTags: AudioTag[] = Array.isArray(parsed.audio_tags)
      ? parsed.audio_tags.map((t: any) => ({
          time: Number(t.time || 0),
          tag: String(t.tag || "audio_event"),
          description: String(t.description || ""),
        }))
      : [];

    if (audioTags.length > 0) {
      const tagsList = audioTags.slice(0, 5).map((t) => `${t.tag} (${t.time}s)`).join(", ");
      onLog?.(`[GEMINI PRO] ${audioTags.length} eventos sonoros/emocionais detectados: ${tagsList}`);
    }

    onLog?.(`[GEMINI PRO] Transcrição concluída com sucesso: ${words.length} palavras mapeadas.`);

    return { words, audioTags };
  } finally {
    // Limpa o arquivo da nuvem para não ocupar quota
    if (uploadedFileName) {
      ai.files.delete({ name: uploadedFileName }).catch(() => {});
    }
  }
}
