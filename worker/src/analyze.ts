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

  return `Abaixo está a transcrição dividida em blocos numerados. Cada linha tem o número do bloco (#), o horário de início e o texto.

Encontre até ${candidateCount} trechos candidatos. Regras:
- Duração de cada trecho: entre ${opts.minSeconds} e ${opts.maxSeconds} segundos (estime pelos horários de início dos blocos).
- Um trecho vai do bloco "startIndex" até o bloco "endIndex", inclusive. Use apenas números de blocos que existem.
- O primeiro bloco deve ser o gancho.

Formato de cada item do array:
{
  "startIndex": número do bloco inicial,
  "endIndex": número do bloco final,
  "title": título curto e chamativo (até 60 caracteres),
  "hook": a frase de abertura ou o motivo de prender a atenção,
  "score": nota de 0 a 100 para o potencial viral,
  "reason": uma frase explicando por que esse trecho funciona
}

TRANSCRIÇÃO:
${transcript}`;
}

function parseCandidates(text: string): ClipCandidate[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("A resposta do Claude não contém um JSON válido:\n" + text);
  }
  return JSON.parse(text.slice(start, end + 1));
}

/** Pede ao Claude os trechos candidatos. */
export async function findCandidates(blocks: Block[], opts: Options): Promise<ClipCandidate[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY no .env");

  const client = new Anthropic();
  const candidateCount = Math.ceil(opts.clips * 1.5); // pede a mais; alguns serão descartados

  const res = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5",
    max_tokens: 8000,
    system: SYSTEM,
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
