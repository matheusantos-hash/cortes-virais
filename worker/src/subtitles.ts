import { writeFile } from "node:fs/promises";
import type { SubtitleStyle, Word } from "./types.js";

export interface SubtitleOptions {
  style?: SubtitleStyle;
  fontSize?: number;
  highlightColor?: string; // BGR format, default: &H0020FFFF& (yellow)
  primaryColor?: string;   // default: &H00FFFFFF& (white)
  outlineColor?: string;   // default: &H00000000& (black)
  fontName?: string;
  maxWordsPerLine?: number;
  marginV?: number;
  enableEmojis?: boolean;
}

function formatAssTime(seconds: number): string {
  const totalMs = Math.max(0, Math.floor(seconds * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const cs = Math.floor((totalMs % 1000) / 10);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Dicionário de mapeamento contextual de palavras-chave para emojis de alta retenção */
const EMOJI_MAP: Record<string, string> = {
  // Finanças e Sucesso
  dinheiro: "💰",
  lucro: "📈",
  milhao: "💵",
  milhões: "💵",
  rico: "🤑",
  vendas: "💸",
  faturamento: "💎",
  investir: "📊",
  // Viral e Intensidade
  fogo: "🔥",
  viral: "🚀",
  bombando: "🔥",
  sucesso: "🏆",
  segredo: "🔑",
  chave: "🔑",
  truque: "💡",
  ideia: "💡",
  // Ação e Alerta
  cuidado: "⚠️",
  atencao: "⚠️",
  atenção: "⚠️",
  perigo: "🚨",
  pare: "🛑",
  erro: "❌",
  urgente: "⏳",
  tempo: "⏱️",
  rapido: "⚡",
  rápido: "⚡",
  // Emoções e Foco
  meta: "🎯",
  foco: "🎯",
  cerebro: "🧠",
  mente: "🧠",
  amor: "❤️",
  incrivel: "🤯",
  incrível: "🤯",
  mentira: "🤫",
  verdade: "✨",
};

function getEmojiForWord(word: string): string | null {
  const clean = word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return EMOJI_MAP[clean] || null;
}

function hexToAssColor(color?: string, fallback = "&H0020FFFF&"): string {
  if (!color) return fallback;
  if (color.startsWith("&H")) return color;
  const clean = color.replace("#", "").trim();
  if (clean.length === 6) {
    const r = clean.slice(0, 2);
    const g = clean.slice(2, 4);
    const b = clean.slice(4, 6);
    return `&H00${b}${g}${r}&`;
  }
  return fallback;
}

/** Paleta de cores rotativas para o estilo Beast (formato BGR do ASS) */
const BEAST_COLORS = [
  "&H0020FFFF&", // Amarelo vibrante
  "&H0033FF33&", // Verde Neon
  "&H00FFFF00&", // Ciano Elétrico
  "&H002288FF&", // Laranja Quente
  "&H00FF33EE&", // Magenta Neon
];

/**
 * Gera um arquivo ASS (Advanced SubStation Alpha) com legendas dinâmicas estilo viral:
 * - Suporte a múltiplos estilos: Hormozi, Apple Minimal, Beast Pop, Clean Minimal
 * - Frases curtas (2 a 4 palavras) para leitura instantânea
 * - Destaque dinâmico na palavra falada com escala e cor personalizada
 */
export async function generateViralAssSubtitles(params: {
  words: Word[];
  clipStart: number;
  clipEnd: number;
  outPath: string;
  opts?: SubtitleOptions;
}): Promise<string | null> {
  const { words, clipStart, clipEnd, outPath, opts = {} } = params;

  // Filtra as palavras que caem dentro deste corte
  const clipWords = words.filter(
    (w) => w.end > clipStart && w.start < clipEnd
  );

  if (!clipWords.length) {
    return null;
  }

  const styleType: SubtitleStyle = opts.style || "hormozi";

  let fontSize = opts.fontSize;
  let highlightColor = hexToAssColor(opts.highlightColor, "&H0020FFFF&");
  let primaryColor = hexToAssColor(opts.primaryColor, "&H00FFFFFF&"); // Branco
  let outlineColor = hexToAssColor(opts.outlineColor, "&H00000000&"); // Preto
  let backColor = "&H80000000&";
  let fontName = opts.fontName ? opts.fontName.split(",")[0].trim() : "DejaVu Sans";
  let maxWordsPerLine = opts.maxWordsPerLine ?? 3;
  let marginV = opts.marginV ?? 420;
  let outlineWidth = 6;
  let shadowDepth = 3;
  let borderStyle = 1; // 1 = Outline + drop shadow, 3 = Opaque box
  let scaleActive = 112;

  // Configuração refinada baseada no estilo selecionado
  switch (styleType) {
    case "apple":
      fontSize = fontSize ?? 58;
      fontName = opts.fontName ? opts.fontName.split(",")[0].trim() : "DejaVu Sans";
      highlightColor = opts.highlightColor ? hexToAssColor(opts.highlightColor) : "&H00FFA834&"; // Azul celeste Apple / Cyan moderno
      outlineWidth = 3;
      shadowDepth = 4;
      marginV = opts.marginV ?? 380;
      scaleActive = 104;
      break;

    case "beast":
      fontSize = fontSize ?? 74;
      fontName = opts.fontName ? opts.fontName.split(",")[0].trim() : "DejaVu Sans";
      highlightColor = opts.highlightColor ? hexToAssColor(opts.highlightColor) : BEAST_COLORS[0];
      outlineWidth = 8;
      shadowDepth = 4;
      marginV = opts.marginV ?? 440;
      scaleActive = 118;
      maxWordsPerLine = 2; // ritmo ainda mais frenético
      break;

    case "minimal":
      fontSize = fontSize ?? 52;
      fontName = opts.fontName ? opts.fontName.split(",")[0].trim() : "DejaVu Sans";
      highlightColor = opts.highlightColor ? hexToAssColor(opts.highlightColor) : "&H0020FFFF&";
      outlineWidth = 3;
      shadowDepth = 2;
      marginV = opts.marginV ?? 280;
      scaleActive = 102;
      maxWordsPerLine = 4;
      break;

    case "hormozi":
    default:
      fontSize = fontSize ?? 70;
      fontName = opts.fontName ? opts.fontName.split(",")[0].trim() : "DejaVu Sans";
      highlightColor = opts.highlightColor ? hexToAssColor(opts.highlightColor) : "&H0020FFFF&"; // Amarelo clássico Hormozi
      outlineWidth = 7;
      shadowDepth = 3;
      marginV = opts.marginV ?? 420;
      scaleActive = 114;
      break;
  }

  const header = `[Script Info]
Title: Cortes Virais Dynamic Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ViralMain,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},${backColor},-1,0,0,0,100,100,1,0,${borderStyle},${outlineWidth},${shadowDepth},2,60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Agrupa as palavras em pedaços de 2 a 3 palavras para ritmo rápido
  const chunks: Word[][] = [];
  let curChunk: Word[] = [];

  for (const w of clipWords) {
    curChunk.push(w);
    const cleanWord = w.punctuated_word || w.word;
    const hasPunctuation = /[.!?]$/.test(cleanWord);
    if (curChunk.length >= maxWordsPerLine || hasPunctuation) {
      chunks.push(curChunk);
      curChunk = [];
    }
  }
  if (curChunk.length) {
    chunks.push(curChunk);
  }

  const events: string[] = [];

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const chunkStartRel = Math.max(0, chunk[0].start - clipStart);
    const chunkEndRel = Math.max(chunkStartRel + 0.1, chunk[chunk.length - 1].end - clipStart);

    // No estilo beast, alterna cores por chunk
    const activeHighlight = styleType === "beast"
      ? BEAST_COLORS[cIdx % BEAST_COLORS.length]
      : highlightColor;

    // Para cada palavra do chunk, cria um evento com a palavra atual destacada
    for (let i = 0; i < chunk.length; i++) {
      const activeWord = chunk[i];
      const wordStartRel = Math.max(chunkStartRel, activeWord.start - clipStart);
      const nextWord = chunk[i + 1];
      const wordEndRel = nextWord 
        ? Math.max(wordStartRel + 0.05, nextWord.start - clipStart)
        : chunkEndRel;

      if (wordEndRel <= wordStartRel) continue;

      const formattedLine = chunk
        .map((w, idx) => {
          let wordStr = (w.punctuated_word || w.word).replace(/[{}]/g, "");
          // Remove emojis unicode que causam falha de segmentação (SIGSEGV) ou glifos corrompidos no libass
          wordStr = wordStr.replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
          if (!wordStr) wordStr = w.word.replace(/[{}]/g, "");

          if (styleType !== "apple") {
            wordStr = wordStr.toUpperCase();
          }

          if (idx === i) {
            // Palavra atual em destaque colorido + escala dinâmica
            return `{\\c${activeHighlight}\\fscx${scaleActive}\\fscy${scaleActive}}${wordStr}{\\c${primaryColor}\\fscx100\\fscy100}`;
          }
          return wordStr;
        })
        .join(" ");

      const startStr = formatAssTime(wordStartRel);
      const endStr = formatAssTime(wordEndRel);

      events.push(`Dialogue: 0,${startStr},${endStr},ViralMain,,0,0,0,,${formattedLine}`);
    }
  }

  if (!events.length) {
    return null;
  }

  const content = header + events.join("\n") + "\n";
  await writeFile(outPath, content, "utf8");
  return outPath;
}
