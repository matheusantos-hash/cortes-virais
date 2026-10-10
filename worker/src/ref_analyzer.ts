import { execFile, spawn } from "node:child_process";
import { probeDuration } from "./media.js";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { StyleBlueprint } from "./types.js";

/**
 * Executa ffprobe para obter a duração do vídeo.
 */

/**
 * Detecta cortes de cena com FFmpeg para medir o ritmo de edição (tempo médio entre cortes).
 * Limitado aos primeiros 45 segundos para economizar CPU.
 */
async function detectSceneCuts(filePath: string, signal?: AbortSignal): Promise<number[]> {
  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-t", "45",
      "-i", filePath,
      "-filter:v", "select='gt(scene,0.3)',metadata=print",
      "-f", "null",
      "-",
    ];

    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const cutTimes: number[] = [];
    let buffer = "";

    p.stderr?.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.includes("pts_time:")) {
          const match = line.match(/pts_time:([0-9.]+)/);
          if (match && match[1]) {
            const t = parseFloat(match[1]);
            if (Number.isFinite(t) && !cutTimes.includes(t)) {
              cutTimes.push(t);
            }
          }
        }
      }
    });

    const cleanup = () => {
      try {
        p.kill("SIGKILL");
      } catch {}
      resolve(cutTimes);
    };

    signal?.addEventListener("abort", cleanup, { once: true });

    p.on("close", () => {
      resolve(cutTimes);
    });

    p.on("error", () => {
      resolve(cutTimes);
    });
  });
}

/**
 * Extrai um frame do vídeo como imagem JPEG compacta (720p).
 */
async function extractFrame(videoPath: string, timeSec: number, outPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-ss", timeSec.toFixed(2),
      "-i", videoPath,
      "-vframes", "1",
      "-vf", "scale='min(640,iw)':-2",
      "-q:v", "4",
      outPath,
    ];

    execFile("ffmpeg", args, (err) => {
      if (err || !existsSync(outPath)) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

const DEFAULT_BLUEPRINT: StyleBlueprint = {
  pacing: "fast",
  averageCutDurationSec: 2.8,
  aestheticStyle: "high energy viral style, high contrast, clean modern framing",
  higgsfieldPromptModifier: "cinematic lighting, ultra detailed, 8k, modern viral aesthetics, smooth motion",
  suggestedBrollKeywords: ["technology", "business growth", "success mindset", "focus"],
  editingTips: "Cortes secos e dinâmicos com abertura impactante nos primeiros 3 segundos.",
};

/**
 * Analisa o vídeo de referência:
 * 1. Mede a frequência de cortes de cena.
 * 2. Extrai frames visuais representativos.
 * 3. Envia os quadros para o Claude Vision extrair o StyleBlueprint.
 */
export async function extractReferenceStyle(params: {
  referenceVideoPath: string;
  workDir: string;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<StyleBlueprint> {
  const { referenceVideoPath, workDir, signal, onLog } = params;

  if (!existsSync(referenceVideoPath)) {
    onLog?.("[CLONE ESTILO] Vídeo de referência não encontrado em disco. Usando perfil padrão.");
    return DEFAULT_BLUEPRINT;
  }

  try {
    onLog?.("[CLONE ESTILO] Iniciando análise técnica e visual do vídeo de referência...");
    const duration = await probeDuration(referenceVideoPath).catch(() => 30);
    onLog?.(`[CLONE ESTILO] Duração da referência: ${duration.toFixed(1)}s. Detectando ritmo de corte...`);

    // 1. Detectar cortes de cena com FFmpeg
    const cuts = await detectSceneCuts(referenceVideoPath, signal);
    let avgCutSec = 3.0;
    if (cuts.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < cuts.length; i++) {
        intervals.push(cuts[i] - cuts[i - 1]);
      }
      const sum = intervals.reduce((a, b) => a + b, 0);
      avgCutSec = Math.max(1.5, Math.min(8.0, Number((sum / intervals.length).toFixed(1))));
      onLog?.(`[CLONE ESTILO] ${cuts.length} cortes de cena detectados (troca média a cada ${avgCutSec}s).`);
    } else {
      onLog?.(`[CLONE ESTILO] Ritmo contínuo detectado. Adotando padrão dinâmico de 2.8s.`);
      avgCutSec = 2.8;
    }

    // 2. Extrair 3 quadros estratégicos
    const frameTimes = [
      Math.min(2, Math.max(0.5, duration * 0.1)),
      Math.max(1, duration * 0.4),
      Math.max(2, duration * 0.75),
    ];

    const frameFiles: string[] = [];
    for (let i = 0; i < frameTimes.length; i++) {
      const fPath = path.join(workDir, `ref_frame_${i + 1}.jpg`);
      const ok = await extractFrame(referenceVideoPath, frameTimes[i], fPath);
      if (ok) frameFiles.push(fPath);
    }

    if (!frameFiles.length) {
      onLog?.("[CLONE ESTILO] Não foi possível extrair frames visuais. Aplicando blueprint baseado no ritmo de cortes.");
      return {
        ...DEFAULT_BLUEPRINT,
        averageCutDurationSec: avgCutSec,
      };
    }

    // 3. Análise visual multimodal com Claude Vision
    if (!process.env.ANTHROPIC_API_KEY) {
      onLog?.("[CLONE ESTILO] ANTHROPIC_API_KEY não definida. Finalizando com blueprint heurístico.");
      return {
        ...DEFAULT_BLUEPRINT,
        averageCutDurationSec: avgCutSec,
      };
    }

    onLog?.(`[CLONE ESTILO] Enviando ${frameFiles.length} quadros para o Claude Vision extrair a estética e direção de arte...`);

    const imageBlocks: Anthropic.ImageBlockParam[] = [];
    for (const f of frameFiles) {
      const buf = await readFile(f);
      imageBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: buf.toString("base64"),
        },
      });
    }

    const anthropic = new Anthropic();
    const prompt = `Você é um Diretor de Arte e Editor de Vídeo viral sênior.
Analise os ${imageBlocks.length} quadros extraídos de um vídeo de referência que o usuário quer clonar.
Métricas técnicas detectadas:
- Ritmo médio entre cortes: a cada ${avgCutSec} segundos.

Sua missão é extrair um "Style Blueprint" (perfil de estilo) em JSON puro, definindo:
1. "pacing": "fast" | "moderate" | "dynamic"
2. "averageCutDurationSec": número em segundos (entre 1.5 e 6.0)
3. "aestheticStyle": resumo curto do estilo visual (ex: "cinematic moody lighting, high contrast, clean minimalist, tech neon")
4. "higgsfieldPromptModifier": prompt em INGLÊS que será usado como modificador estético para gerar vídeos/b-rolls com IA no Higgsfield AI. Deve garantir que o vídeo gerado por IA tenha a mesma textura, iluminação, paleta de cores e atmosfera da referência.
5. "suggestedBrollKeywords": array com 3 a 5 palavras-chave visuais em inglês que combinam com este visual.
6. "editingTips": instrução em português em 1 linha sobre como posicionar legendas, enquadramento e dinamismo para clonar a edição.

Responda SOMENTE o JSON puro, sem markdown e sem explicações adicionais:
{
  "pacing": "fast",
  "averageCutDurationSec": ${avgCutSec},
  "aestheticStyle": "...",
  "higgsfieldPromptModifier": "...",
  "suggestedBrollKeywords": ["..."],
  "editingTips": "..."
}`;

    const content: Anthropic.MessageParam["content"] = [
      ...imageBlocks,
      { type: "text", text: prompt },
    ];

    const modelEnv = process.env.CLAUDE_MODEL?.trim();
    const candidateModels = Array.from(
      new Set([
        modelEnv,
        "claude-sonnet-5-5",
        "claude-sonnet-5",
        "claude-3-5-sonnet-20241022",
        "claude-3-7-sonnet-20250219",
        "claude-sonnet-4-5-20250929",
      ])
    ).filter(Boolean) as string[];

    let res: any;
    let lastErr: any;
    for (const modelName of candidateModels) {
      try {
        res = await anthropic.messages.create({
          model: modelName,
          max_tokens: 1500,
          messages: [{ role: "user", content }],
        });
        break;
      } catch (err: any) {
        lastErr = err;
        if (err?.status === 404 || err?.message?.includes("not_found")) {
          onLog?.(`[CLONE ESTILO] Modelo "${modelName}" não disponível (404). Tentando modelo alternativo...`);
          continue;
        }
        throw err;
      }
    }
    if (!res) throw lastErr;

    let replyText = res.content.flatMap((b: any) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (replyText.startsWith("```")) {
      replyText = replyText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }
    const jsonStart = replyText.indexOf("{");
    const jsonEnd = replyText.lastIndexOf("}");

    if (jsonStart !== -1 && jsonEnd !== -1) {
      let jsonStr = replyText.slice(jsonStart, jsonEnd + 1);
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, "$1");
      const parsed = JSON.parse(jsonStr) as StyleBlueprint;
      onLog?.(`[CLONE ESTILO] Estilo visual clonado com sucesso: "${parsed.aestheticStyle}" (Ritmo: ${parsed.pacing}).`);
      onLog?.(`[CLONE ESTILO] Prompt base Higgsfield configurado: "${parsed.higgsfieldPromptModifier}"`);

      // Limpeza dos frames temporários
      for (const f of frameFiles) {
        rm(f, { force: true }).catch(() => {});
      }

      return {
        pacing: parsed.pacing || "fast",
        averageCutDurationSec: parsed.averageCutDurationSec || avgCutSec,
        aestheticStyle: parsed.aestheticStyle || DEFAULT_BLUEPRINT.aestheticStyle,
        higgsfieldPromptModifier: parsed.higgsfieldPromptModifier || DEFAULT_BLUEPRINT.higgsfieldPromptModifier,
        suggestedBrollKeywords: parsed.suggestedBrollKeywords?.length ? parsed.suggestedBrollKeywords : DEFAULT_BLUEPRINT.suggestedBrollKeywords,
        editingTips: parsed.editingTips || DEFAULT_BLUEPRINT.editingTips,
      };
    }

    onLog?.("[CLONE ESTILO] Resposta da IA não continha JSON legível. Usando perfil padrão ajustado.");
    return { ...DEFAULT_BLUEPRINT, averageCutDurationSec: avgCutSec };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onLog?.(`[CLONE ESTILO] Aviso: Análise do estilo de referência falhou (${msg}). Prosseguindo com preset inteligente.`);
    return DEFAULT_BLUEPRINT;
  }
}
