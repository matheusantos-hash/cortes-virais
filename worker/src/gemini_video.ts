import { GoogleGenAI } from "@google/genai";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { VisualHighlight } from "./types.js";
import { probeDuration } from "./media.js";

/**
 * Gera um preview ultraleve do vídeo para upload rápido no Gemini AI.
 * - Resolução reduzida (máx 640px de largura)
 * - CRF 32 com libx264 (compactação extrema sem perda de marcos visuais)
 * - Sem áudio (-an) para economizar dados
 * - -vsync vfr para evitar qualquer descompasso (drift) de timestamps com a transcrição
 * - Limite de duração para vídeos longos evitando travar CPU do container
 */
async function generatePreviewVideo(
  sourcePath: string,
  outPath: string,
  durationLimitSec?: number,
  signal?: AbortSignal,
  onLog?: (msg: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    onLog?.("[GEMINI VISION] Comprimindo vídeo de preview (640p, ultra-compacto) para análise visual rápida...");

    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
    ];

    if (durationLimitSec && durationLimitSec > 0) {
      args.push("-t", durationLimitSec.toFixed(1));
    }

    args.push(
      "-i", sourcePath,
      "-vf", "scale='min(640,iw)':-2",
      "-c:v", "libx264",
      "-crf", "32",
      "-preset", "veryfast",
      "-vsync", "vfr",
      "-an",
      outPath
    );

    const child = execFile("ffmpeg", args, (err) => {
      if (err) {
        if (signal?.aborted) return reject(new Error("Geração de preview cancelada"));
        return reject(new Error(`Falha no FFmpeg ao gerar preview de vídeo: ${err.message}`));
      }
      resolve();
    });

    signal?.addEventListener(
      "abort",
      () => {
        try {
          child.kill("SIGKILL");
        } catch {}
        reject(new Error("Geração de preview cancelada"));
      },
      { once: true }
    );
  });
}

/**
 * Aguarda o arquivo de vídeo mudar de 'PROCESSING' para 'ACTIVE' nos servidores Google AI.
 */
async function waitForActiveFile(
  ai: GoogleGenAI,
  fileName: string,
  maxWaitMs = 180_000,
  onLog?: (msg: string) => void
): Promise<void> {
  const start = Date.now();
  let lastLoggedSec = 0;

  while (Date.now() - start < maxWaitMs) {
    const file = await ai.files.get({ name: fileName });
    if (file.state === "ACTIVE") return;
    if (file.state === "FAILED") throw new Error(`O processamento do vídeo no Google Gemini falhou: ${fileName}`);

    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    if (elapsedSec - lastLoggedSec >= 15) {
      lastLoggedSec = elapsedSec;
      onLog?.(`[GEMINI VISION] Indexando e preparando vídeo nos servidores Google AI (${elapsedSec}s)...`);
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("Tempo limite excedido aguardando processamento do vídeo no Google Gemini.");
}

/**
 * Executa a análise visual do vídeo via Gemini com capacidade Agentic Video Understanding.
 * Identifica marcos visuais de alto impacto: expressões faciais extremas, gestos, telas e reações.
 */
export async function analyzeVideoVisuals(args: {
  videoPath: string;
  workDir: string;
  language?: string;
  signal?: AbortSignal;
  onLog?: (msg: string) => void;
}): Promise<VisualHighlight[]> {
  const { videoPath, workDir, onLog, signal } = args;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    onLog?.("[AVISO] GEMINI_API_KEY não configurada. Análise visual ignorada.");
    return [];
  }

  if (!existsSync(videoPath)) {
    throw new Error(`Arquivo de vídeo original não encontrado: ${videoPath}`);
  }

  const previewPath = path.join(workDir, "preview_gemini.mp4");
  if (!existsSync(previewPath)) {
    const duration = await probeDuration(videoPath).catch(() => 0);
    const maxSec = 600; // Máximo de 10 minutos para análise visual em vídeos longos
    const limitSec = duration > maxSec ? maxSec : undefined;
    if (limitSec) {
      onLog?.(`[GEMINI VISION] Vídeo longo detectado (${Math.round(duration / 60)} min). Limitando preview aos primeiros ${Math.round(limitSec / 60)} min para economizar CPU.`);
    }
    await generatePreviewVideo(videoPath, previewPath, limitSec, signal, onLog);
  }

  if (signal?.aborted) throw new Error("Análise cancelada pelo usuário");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_VIDEO_MODEL || "gemini-3.7-flash";

  onLog?.(`[GEMINI VISION] Enviando preview otimizado para o Google AI Studio (${model})...`);

  let uploadedFileName: string | null = null;
  try {
    const uploadResult = await ai.files.upload({
      file: previewPath,
      config: {
        mimeType: "video/mp4",
      },
    });

    uploadedFileName = uploadResult.name ?? null;
    if (!uploadedFileName) {
      throw new Error("Falha ao obter identificador do arquivo no Google Gemini.");
    }

    onLog?.(`[GEMINI VISION] Vídeo recebido pela nuvem (ID: ${uploadedFileName}). Aguardando validação de status...`);

    if (uploadResult.state && uploadResult.state !== "ACTIVE") {
      await waitForActiveFile(ai, uploadedFileName, 180_000, onLog);
    }

    if (signal?.aborted) throw new Error("Análise cancelada pelo usuário");

    onLog?.(`[GEMINI VISION] Vídeo ativo. Executando Agentic Video Understanding para detectar picos de engajamento visual...`);

    const prompt = `Você é um diretor de fotografia e editor sênior de conteúdo viral para redes sociais (TikTok, Reels, Shorts).
Analise este vídeo com máxima atenção aos momentos visuais de alto impacto e picos de expressão corporal/facial.

Sua missão:
Identifique entre 4 e 15 momentos visuais que prendem a atenção instantaneamente:
1. 'facial_expression': Expressões faciais intensas (choque, surpresa, riso aberto, descontentamento enfático, sobrancelhas levantadas, emoção).
2. 'high_energy_gesture': Gestos marcantes (apontar para a câmera, bater na mesa, movimentação rápida das mãos, ênfase física).
3. 'screen_demo': Momentos onde há compartilhamento de tela, gráficos, números ou slides visíveis relevantes.
4. 'reaction': Reações visuais de host/convidado ouvindo o outro orador.
5. 'audience_laughter': Reações de plateia ou ambiente.

Para cada momento, informe o início e fim exatos em segundos, uma breve descrição do que acontece visualmente e uma nota de intensidade de 1 a 10.

Responda ESTRITAMENTE em formato JSON puro, sem markdown e sem blocos de texto adicionais:
{
  "highlights": [
    {
      "startSec": 12.4,
      "endSec": 16.2,
      "type": "facial_expression",
      "description": "Orador arregala os olhos e abre a boca em sinal de choque com o dado revelado",
      "intensityScore": 9
    }
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
                mimeType: uploadResult.mimeType || "video/mp4",
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
      onLog?.("[GEMINI VISION] Nenhuma resposta gerada pelo modelo.");
      return [];
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const clean = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      parsed = JSON.parse(clean);
    }

    const items = Array.isArray(parsed.highlights) ? parsed.highlights : Array.isArray(parsed) ? parsed : [];

    const highlights: VisualHighlight[] = items
      .map((h: any) => ({
        startSec: Number(h.startSec || 0),
        endSec: Number(h.endSec || 0),
        type: String(h.type || "other") as VisualHighlight["type"],
        description: String(h.description || "").trim(),
        intensityScore: Math.min(10, Math.max(1, Number(h.intensityScore || 5))),
      }))
      .filter((h: VisualHighlight) => h.endSec > h.startSec && h.intensityScore >= 5)
      .sort((a: VisualHighlight, b: VisualHighlight) => a.startSec - b.startSec);

    return highlights;
  } finally {
    // Blindagem anti-vazamento de quota: sempre remove o arquivo na nuvem Google AI Studio
    if (uploadedFileName) {
      ai.files.delete({ name: uploadedFileName }).catch(() => {});
    }
    // Remove o preview local para poupar espaço em disco do worker
    if (existsSync(previewPath)) {
      rm(previewPath, { force: true }).catch(() => {});
    }
  }
}
