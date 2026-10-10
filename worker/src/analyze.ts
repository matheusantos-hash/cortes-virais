import Anthropic from "@anthropic-ai/sdk";
import { fmtClock as fmt } from "./format.js";
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
    } else if (opts.brollSource === "auto") {
      brollRules = `\n- B-ROLLS HÍBRIDOS INTELIGENTES (AUTO): Para cada trecho, identifique de 1 a 2 momentos visuais de alto impacto para inserir B-rolls contextuais. Se o momento for um gancho conceitual, metáfora ou cena cinematográfica, descreva um prompt detalhado em inglês. Se for uma cena realista ou cotidiana, use termos visuais objetivos (ex: "luxury car interior", "hand counting money", "person typing on laptop"). No campo "brolls", informe "offsetSec" (início da cena), "durationSec" (2 a 4 segundos) e "keyword" (em inglês).`;
    } else {
      brollRules = `\n- B-ROLLS / VÍDEOS DE APOIO: Para cada trecho, identifique de 1 a 3 momentos visuais onde um vídeo de apoio enriqueceria o corte. No campo "brolls", informe o "offsetSec" (segundos após o início do clipe), "durationSec" (entre 2 e 4 segundos) e "keyword" (termo de busca em inglês curto e visual para banco de vídeos, ex: "luxury car", "person thinking", "money stack", "bitcoin graphic").`;
    }
  }

  let visualGuidance = "";
  if (opts.visualHighlights && opts.visualHighlights.length > 0) {
    const lines = opts.visualHighlights.slice(0, 15).map(
      (v) => `- [${fmt(v.startSec)} - ${fmt(v.endSec)}] (${v.type.toUpperCase()}, intensidade ${v.intensityScore}/10): ${v.description}`
    );
    visualGuidance = `\n---
MARCOS VISUAIS IDENTIFICADOS NO VÍDEO (GEMINI AGENTIC VIDEO UNDERSTANDING):
${lines.join("\n")}
DIRETRIZ VISUAL: Priorize trechos e ganchos onde haja alta intensidade visual nos primeiros segundos ou momentos marcantes na tela. Preencha o campo opcional "visualContext" explicando como a imagem reforça a fala.
---\n`;
  }

  return `Abaixo está a transcrição dividida em blocos numerados. Cada linha tem o número do bloco (#), o horário de início e o texto.
${referenceGuidelines}
${visualGuidance}
Encontre até ${candidateCount} trechos candidatos. Regras:
- Duração de cada trecho: entre ${opts.minSeconds} e ${opts.maxSeconds} segundos (estime pelos horários de início dos blocos).
- Um trecho vai do bloco "startIndex" até o bloco "endIndex", inclusive. Use apenas números de blocos que existem.
- Seja objetivo e conciso nos campos 'hook' e 'reason' (máximo 1 a 2 frases) para manter a resposta compacta.
${brollRules}

Formato de cada item do array:
{
  "startIndex": número do bloco inicial,
  "endIndex": número do bloco final,
  "title": título curto e chamativo (até 60 caracteres),
  "hook": a frase de abertura ou o motivo de prender a atenção,
  "score": nota de 0 a 100 para o potencial viral,
  "reason": uma frase explicando por que esse trecho funciona,
  "visualContext": "breve nota de como o momento visual reforça o corte (ou null)"${opts.useBroll ? ',\n  "brolls": [\n    { "offsetSec": 4.0, "durationSec": 3.0, "keyword": "money investment" }\n  ]' : ""}
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
  if (start === -1) {
    throw new Error("A resposta do Claude não contém um array JSON:\n" + text.slice(0, 300));
  }

  // 1. Tentativa padrão se o array fechou normalmente com ']'
  const end = cleaned.lastIndexOf("]");
  if (end > start) {
    try {
      let jsonStr = cleaned.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // 2. Recuperação inteligente se foi truncado antes do ']': fecha na última chave '}' completa
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > start) {
    try {
      let sub = cleaned.slice(start, lastBrace + 1).replace(/,\s*$/, "");
      const closed = sub + "\n]";
      const parsed = JSON.parse(closed.replace(/,\s*([\]}])/g, "$1"));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  // 3. Recuperação granular por item individual via regex
  const itemMatches = cleaned.match(/\{\s*"startIndex"[\s\S]*?\}/g) || [];
  const recovered: ClipCandidate[] = [];
  for (const m of itemMatches) {
    try {
      const obj = JSON.parse(m.replace(/,\s*([\]}])/g, "$1"));
      if (typeof obj.startIndex === "number" && typeof obj.endIndex === "number") {
        recovered.push(obj);
      }
    } catch {}
  }

  if (recovered.length > 0) return recovered;

  return [];
}

/** Pede ao Claude os trechos candidatos com Extended Thinking e Prompt Caching da Anthropic. */
export async function findCandidates(
  blocks: Block[],
  opts: Options,
  onLog?: (msg: string) => void
): Promise<ClipCandidate[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY no .env");

  const client = new Anthropic();
  const candidateCount = Math.ceil(opts.clips * 1.5); // pede a mais; alguns serão descartados
  const useThinking = opts.enableExtendedThinking !== false;
  const budgetTokens = useThinking ? Math.max(1024, Math.min(4096, opts.thinkingBudgetTokens ?? 2048)) : 0;
  const outputTokensReserve = Math.min(6000, Math.max(3000, candidateCount * 450));
  // max_tokens deve cobrir obrigatoriamente budgetTokens + outputTokensReserve para evitar truncamento silencioso
  const dynamicMaxTokens = budgetTokens + outputTokensReserve;

  const modelEnv = process.env.CLAUDE_MODEL?.trim();
  const preferredModel = modelEnv || (useThinking ? "claude-sonnet-5-5" : "claude-sonnet-5-5");

  // Lista de modelos suportados pela Anthropic ordenada por preferência
  const candidateModels = Array.from(
    new Set([
      preferredModel,
      "claude-sonnet-5-5",
      "claude-sonnet-5",
    ])
  ).filter(Boolean);

  let res: any;
  let lastError: any;

  for (const model of candidateModels) {
    const createParams: any = {
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
    };

    if (useThinking) {
      if (/claude-5|sonnet-5/i.test(model)) {
        createParams.thinking = { type: "adaptive" };
      } else if (/claude-3-7|claude-4/i.test(model)) {
        createParams.thinking = {
          type: "enabled",
          budget_tokens: budgetTokens,
        };
      }
    }

    try {
      res = await client.messages.create(createParams);
      break;
    } catch (apiErr: any) {
      lastError = apiErr;

      // Se falhou por parâmetro de thinking inválido (400), tenta o mesmo modelo sem thinking
      if (createParams.thinking && (apiErr?.message?.includes("thinking") || apiErr?.status === 400)) {
        onLog?.(`[AVISO CLAUDE] Modelo "${model}" não aceitou parâmetro de Extended Thinking (${apiErr?.message || "erro"}). Retentando automaticamente em modo editorial padrão...`);
        delete createParams.thinking;
        createParams.max_tokens = Math.min(createParams.max_tokens, 4096);
        try {
          res = await client.messages.create(createParams);
          break;
        } catch (retryErr: any) {
          lastError = retryErr;
          if (retryErr?.status === 404 || retryErr?.message?.includes("not_found")) {
            onLog?.(`[AVISO CLAUDE] Modelo "${model}" não disponível (404). Tentando modelo alternativo...`);
            continue;
          }
          throw retryErr;
        }
      }

      // Se falhou com 404 (not_found_error), tenta próximo modelo da lista
      if (apiErr?.status === 404 || apiErr?.message?.includes("not_found")) {
        onLog?.(`[AVISO CLAUDE] Modelo "${model}" não encontrado no provedor Anthropic (404). Tentando modelo alternativo...`);
        continue;
      }

      throw apiErr;
    }
  }

  if (!res) {
    throw lastError || new Error("Nenhum modelo Claude disponível respondeu à requisição.");
  }

  let text = "";
  let thinkingSummary = "";

  for (const b of res.content) {
    if (b.type === "thinking") {
      thinkingSummary += (b as any).thinking + "\n";
    } else if (b.type === "text") {
      text += b.text;
    }
  }

  if (thinkingSummary.trim() && onLog) {
    const cleanThought = thinkingSummary.trim().replace(/\s+/g, " ");
    const preview = cleanThought.length > 250 ? cleanThought.slice(0, 250) + "..." : cleanThought;
    onLog(`[CLAUDE THINKING] Raciocínio editorial concluído (${budgetTokens} tokens). Análise: "${preview}"`);
  }

  const candidates = parseCandidates(text);

  // Se o Claude retornou vazio mas temos blocos na transcrição (ex: vídeo curto de 10-20s):
  if (!candidates.length && blocks.length > 0) {
    const firstText = blocks[0].text;
    return [
      {
        startIndex: 0,
        endIndex: blocks.length - 1,
        title: "Destaque do Vídeo",
        hook: firstText.slice(0, 80),
        score: 75,
        reason: "Momento viral capturado do vídeo completo.",
      },
    ];
  }

  return candidates;
}

/** Valida os candidatos, converte blocos em segundos, remove sobreposição e pega os melhores. */
export function selectClips(candidates: ClipCandidate[], blocks: Block[], opts: Options): Clip[] {
  const TOLERANCE = 0.25; // margem flexível para vídeos curtos ou cortes aproximados
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
      visualContext: c.visualContext,
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
          visualContext: c.visualContext,
          start: a.start,
          end: Math.max(a.start + Math.min(5, opts.minSeconds), clampedEnd),
        });
      }
    }
  }

  // Fallback garantido para vídeos curtos onde a transcrição inteira deve ser aproveitada
  if (!valid.length && blocks.length > 0) {
    const a = blocks[0];
    const b = blocks[blocks.length - 1];
    valid.push({
      title: candidates[0]?.title || "Destaque do Vídeo",
      hook: candidates[0]?.hook || a.text.slice(0, 80),
      score: candidates[0]?.score || 75,
      reason: candidates[0]?.reason || "Trecho integral aproveitado com sucesso.",
      start: a.start,
      end: b.end,
    });
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
