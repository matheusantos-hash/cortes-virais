import Anthropic from "@anthropic-ai/sdk";
import type { Block, Clip, ClipCandidate, Options, Word } from "./types.js";

/** Agrupa as palavras em blocos de frase (4–20 s) para o Claude enxergar a estrutura. */
export function buildBlocks(words: Word[]): Block[] {
  const blocks: Block[] = [];
  let cur: Word[] = [];

  const flush = () => {
    if (!cur.length) return;
    blocks.push({
      index: blocks.length,
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.punctuated_word ?? w.word).join(" "),
    });
    cur = [];
  };

  for (const w of words) {
    cur.push(w);
    const dur = w.end - cur[0].start;
    const endsSentence = /[.!?…]$/.test(w.punctuated_word ?? w.word);
    if ((endsSentence && dur >= 4) || dur >= 20) flush();
  }
  flush();
  return blocks;
}

function fmt(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h, m, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

const SYSTEM = `Você é um editor de vídeo especialista em conteúdo viral para TikTok, Reels e YouTube Shorts.
Sua tarefa é encontrar, na transcrição de um vídeo longo, os trechos com maior potencial de viralizar.

Um bom trecho viral:
- Começa com um GANCHO forte nos primeiros segundos: uma afirmação surpreendente, uma pergunta, uma opinião polêmica, uma promessa ou o início de uma história curiosa.
- É AUTOCONTIDO: quem nunca viu o vídeo original entende sem contexto.
- Tem começo, meio e fim: termina numa conclusão, punchline, revelação ou frase de impacto, nunca cortado no meio de uma ideia.
- Provoca emoção (humor, surpresa, indignação, inspiração) ou entrega valor prático rápido.
- Começa e termina em limites naturais de fala.

Evite trechos que começam no meio de um raciocínio, dependem de algo dito antes, são enrolação, apresentação de convidado, propaganda ou despedida.
Os trechos não podem se sobrepor.

Responda SOMENTE com um array JSON, sem texto antes ou depois e sem markdown.`;

function buildUserPrompt(blocks: Block[], opts: Options, candidateCount: number): string {
  const transcript = blocks.map((b) => `#${b.index} [${fmt(b.start)}] ${b.text}`).join("\n");

  let referenceGuidelines = "";
  if (opts.styleBlueprint) {
    const bp = opts.styleBlueprint;
    referenceGuidelines = `\n---
PERFIL DE ESTILO CLONADO DO VÍDEO DE REFERÊNCIA (IA):
- Ritmo de Edição: ${bp.pacing.toUpperCase()} (troca de cenas média a cada ${bp.averageCutDurationSec} segundos).
- Estilo Visual & Atmosfera: "${bp.aestheticStyle}".
- Dicas de Direção: "${bp.editingTips}".
- Temas Visuais Recomendados: ${bp.suggestedBrollKeywords.join(", ")}.
${opts.designInstructions ? `- Instruções Adicionais do Usuário: "${opts.designInstructions}"` : ""}
IMPORTANTE: Selecione trechos cujo gancho e clímax sigam estritamente o ritmo e intensidade deste perfil clonado!
---\n`;
  } else if (opts.referenceStyle || opts.designInstructions || opts.referenceUrl) {
    referenceGuidelines = `\n---
DIRETRIZES DE DESIGN E ESTILO DO VÍDEO DE REFERÊNCIA:
${opts.referenceStyle ? `- Estilo de Referência Selecionado: "${opts.referenceStyle}"` : ""}
${opts.designInstructions ? `- Instruções de Design & Dinâmica do Usuário: "${opts.designInstructions}"` : ""}
${opts.referenceUrl ? `- Vídeo de Referência (TikTok/Reels/Shorts): ${opts.referenceUrl}` : ""}
IMPORTANTE: Priorize selecionar trechos, ganchos e momentos que correspondam estritamente ao tom, energia e ritmo solicitado nas diretrizes acima!
---\n`;
  }

  let brollRules = "";
  if (opts.useBroll) {
    if (opts.brollSource === "higgsfield") {
      brollRules = `\n- B-ROLLS VIA HIGGSFIELD AI: Para cada clipe, identifique o momento de MAIOR impacto visual (preferencialmente nos primeiros 4 segundos para reforçar o gancho) onde um vídeo cinemático gerado por IA multiplicará a retenção. No campo "brolls", informe o "offsetSec" (ex: 2.0 ou 3.0), "durationSec" (entre 2.5 e 4.0 segundos) e "keyword" (uma descrição visual cinematográfica em inglês detalhada, ex: "cyberpunk glowing data visualization", "luxurious private jet interior dramatic lighting", "macro human eye dilating with reflection").`;
    } else {
      brollRules = `\n- B-ROLLS / VÍDEOS DE APOIO: Para cada trecho, identifique de 1 a 3 momentos visuais onde um vídeo de apoio enriqueceria o corte. No campo "brolls", informe o "offsetSec" (segundos após o início do clipe), "durationSec" (entre 2 e 4 segundos) e "keyword" (termo de busca em inglês curto e visual para banco de vídeos, ex: "luxury car", "person thinking", "money stack", "bitcoin graphic").`;
    }
  }

  return `Abaixo está a transcrição dividida em blocos numerados. Cada linha tem o número do bloco (#), o horário de início e o texto.
${referenceGuidelines}
Encontre até ${candidateCount} trechos candidatos. Regras:
- Duração de cada trecho: entre ${opts.minSeconds} e ${opts.maxSeconds} segundos (estime pelos horários de início dos blocos).
- Um trecho vai do bloco "startIndex" até o bloco "endIndex", inclusive. Use apenas números de blocos que existem.
- O primeiro bloco deve ser o gancho.${brollRules}

Formato de cada item do array:
{
  "startIndex": número do bloco inicial,
  "endIndex": número do bloco final,
  "title": título curto e chamativo (até 60 caracteres),
  "hook": a frase de abertura ou o motivo de prender a atenção,
  "score": nota de 0 a 100 para o potencial viral,
  "reason": uma frase explicando por que esse trecho funciona${opts.useBroll ? ',\n  "brolls": [\n    { "offsetSec": 4.0, "durationSec": 3.0, "keyword": "money investment" }\n  ]' : ""}
}

TRANSCRIÇÃO:
${transcript}`;
}

function parseCandidates(text: string): ClipCandidate[] {
  // Remove markdown de codeblocks caso o Claude retorne com ```json ... ```
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("A resposta do Claude não contém um array JSON válido:\n" + text.slice(0, 300));
  }

  let jsonStr = cleaned.slice(start, end + 1);
  // Remove trailing commas acidentais antes de fechamento de objeto ou array
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, "$1");

  return JSON.parse(jsonStr);
}

/** Pede ao Claude os trechos candidatos com Prompt Caching da Anthropic para economizar tokens. */
export async function findCandidates(blocks: Block[], opts: Options): Promise<ClipCandidate[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY no .env");

  const client = new Anthropic();
  const candidateCount = Math.ceil(opts.clips * 1.5); // pede a mais; alguns serão descartados
  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";
  const dynamicMaxTokens = Math.min(4000, Math.max(1500, candidateCount * 280));

  const res = await client.messages.create({
    model,
    max_tokens: dynamicMaxTokens,
    system: [
      {
        type: "text",
        text: SYSTEM,
        // Ativa Prompt Caching na Anthropic (90% de desconto de tokens no prompt do sistema)
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserPrompt(blocks, opts, candidateCount) }],
  });

  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return parseCandidates(text);
}

/** Valida os candidatos, converte blocos em segundos, remove sobreposição e pega os melhores. */
export function selectClips(candidates: ClipCandidate[], blocks: Block[], opts: Options): Clip[] {
  const TOLERANCE = 0.15; // o Claude estima a duração; aceitamos uma margem
  const minOk = opts.minSeconds * (1 - TOLERANCE);
  const maxOk = opts.maxSeconds * (1 + TOLERANCE);

  const valid: Clip[] = [];
  for (const c of candidates) {
    const a = blocks[c.startIndex];
    const b = blocks[c.endIndex];
    if (!a || !b || c.endIndex < c.startIndex) continue;
    const duration = b.end - a.start;
    if (duration < minOk || duration > maxOk) continue;
    valid.push({
      title: c.title,
      hook: c.hook,
      score: c.score,
      reason: c.reason,
      start: a.start,
      end: b.end,
      brolls: c.brolls?.map((br) => ({
        offsetSec: Math.max(0, Number(br.offsetSec) || 0),
        durationSec: Math.min(5, Math.max(2, Number(br.durationSec) || 3)),
        keyword: String(br.keyword || "").trim(),
      })),
    });
  }

  // Fallback resiliente: se a duração estimada pelo Claude exceder levemente o range, ajusta os limites
  if (!valid.length && candidates.length > 0) {
    for (const c of candidates) {
      const a = blocks[c.startIndex];
      const b = blocks[c.endIndex];
      if (a && b && c.endIndex >= c.startIndex) {
        const rawDur = b.end - a.start;
        const clampedEnd = rawDur > opts.maxSeconds ? a.start + opts.maxSeconds : b.end;
        valid.push({
          title: c.title,
          hook: c.hook,
          score: c.score,
          reason: c.reason,
          start: a.start,
          end: Math.max(a.start + Math.min(10, opts.minSeconds), clampedEnd),
        });
      }
    }
  }

  valid.sort((x, y) => y.score - x.score);

  const chosen: Clip[] = [];
  for (const c of valid) {
    if (chosen.some((o) => c.start < o.end && o.start < c.end)) continue;
    chosen.push(c);
    if (chosen.length >= opts.clips) break;
  }
  return chosen;
}
