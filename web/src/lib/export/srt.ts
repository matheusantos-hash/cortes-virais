import type { Clip } from "@/lib/types";

function formatSrtTime(sec: number): string {
  const s = Math.max(0, sec);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":") + `,${String(ms).padStart(3, "0")}`;
}

/**
 * Gera um arquivo SRT editável para importar no Premiere Pro (Captions) ou DaVinci Resolve (Subtitles).
 * Os tempos são relativos ao início do corte (00:00:00,000 em diante).
 */
export function generateClipSrt(clip: Clip): string {
  const words = clip.edit_decisions?.words;
  const clipStart = Number(clip.start_seconds);

  if (!words || words.length === 0) {
    // Se não houver palavras mapeadas individualmente, cria uma legenda placeholder com o título/gancho
    return `1
00:00:00,000 --> 00:00:04,000
${clip.hook || clip.title}
`;
  }

  // Agrupa palavras em frases de 3 a 5 palavras para leitura confortável
  const chunks: { start: number; end: number; text: string }[] = [];
  const GROUP_SIZE = 4;

  for (let i = 0; i < words.length; i += GROUP_SIZE) {
    const group = words.slice(i, i + GROUP_SIZE);
    const start = Math.max(0, group[0].s - clipStart);
    const end = Math.max(start + 0.3, group[group.length - 1].e - clipStart);
    const text = group.map((w) => w.w).join(" ");
    chunks.push({ start, end, text });
  }

  return chunks
    .map((c, idx) => {
      return `${idx + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}\n`;
    })
    .join("\n");
}
