export interface Word {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
}

/** Trecho da transcrição (uma ou poucas frases) com início e fim em segundos. */
export interface Block {
  index: number;
  start: number;
  end: number;
  text: string;
}

export interface BrollItem {
  offsetSec: number;
  durationSec: number;
  keyword: string;
  filePath?: string;
}

export interface VisualHighlight {
  startSec: number;
  endSec: number;
  type: "facial_expression" | "high_energy_gesture" | "reaction" | "screen_demo" | "audience_laughter" | "other";
  description: string;
  intensityScore: number;
}

/** O que o Claude devolve: índices de blocos, não segundos. */
export interface ClipCandidate {
  startIndex: number;
  endIndex: number;
  title: string;
  hook: string;
  score: number;
  reason: string;
  visualContext?: string;
  brolls?: { offsetSec: number; durationSec: number; keyword: string }[];
}

export interface Clip {
  title: string;
  hook: string;
  score: number;
  reason: string;
  visualContext?: string;
  start: number;
  end: number;
  brolls?: BrollItem[];
}

export interface StyleBlueprint {
  pacing: "fast" | "moderate" | "dynamic";
  averageCutDurationSec: number;
  aestheticStyle: string;
  higgsfieldPromptModifier: string;
  suggestedBrollKeywords: string[];
  editingTips: string;
}

export type Orientation = "vertical" | "horizontal";
export type VerticalMode = "blur" | "crop" | "split" | "face_tracking" | "split_face";
export type ReferenceType = "link" | "upload" | "preset" | "none";
export type BrollSource = "auto" | "pexels" | "higgsfield" | "none";

export type SubtitleStyle = "hormozi" | "beast" | "apple" | "minimal";

export interface Options {
  orientation: Orientation;
  clips: number;
  minSeconds: number;
  maxSeconds: number;
  language: string;
  verticalMode: VerticalMode;
  cropX: number;
  referenceType?: ReferenceType;
  referenceUrl?: string | null;
  referencePath?: string | null;
  referenceStyle?: string | null;
  designInstructions?: string | null;
  styleBlueprint?: StyleBlueprint | null;
  useBroll?: boolean;
  brollSource?: BrollSource;
  subtitles?: boolean;
  subtitleStyle?: SubtitleStyle;
  primaryColor?: string;
  highlightColor?: string;
  enableSfx?: boolean;
  enableEmojis?: boolean;
  dynamicZoom?: boolean;
  colorGrade?: boolean;
  customFontPath?: string | null;
  customFontName?: string | null;
  fontsDir?: string | null;
  transcriptionProvider?: "deepgram" | "gemini" | "auto";
  enableVisualAnalysis?: boolean;
  enableExtendedThinking?: boolean;
  thinkingBudgetTokens?: number;
  visualHighlights?: VisualHighlight[];
  exportSettings?: ExportSettings;
  force: boolean;
  dryRun: boolean;
}

export interface ExportSettings {
  resolution?: "1080x1920" | "2160x3840" | "1920x1080" | "1080x1080";
  codec?: "h264" | "hevc" | "prores422";
  fps?: 24 | 30 | 60;
  bitrate?: "master" | "high" | "standard";
  audioNormalization?: boolean; // EBU R128 (-14 LUFS)
  generateNleTimeline?: boolean; // XML / EDL
}

/** Metadados técnicos do arquivo-fonte (via ffprobe). Base para precisão de frame e relink no NLE. */
export interface SourceMeta {
  /** Nome original do arquivo (usado pelo Premiere/Resolve para reconectar a mídia original). */
  fileName: string;
  durationSec: number;
  /** Frame rate como fração exata (ex.: 30000/1001 = 29,97). */
  fpsNum: number;
  fpsDen: number;
  width: number;
  height: number;
  /** Timecode inicial gravado no arquivo ("HH:MM:SS:FF" ou "HH:MM:SS;FF" para drop-frame). */
  startTimecode: string | null;
  audioChannels: number;
  audioSampleRate: number;
  videoCodec: string | null;
  /** true quando o arquivo parece ter frame rate variável (celular/OBS). */
  vfr: boolean;
}

/**
 * Decisões de edição de um clipe, gravadas em clips.edit_decisions.
 * Tempos relativos (offsetSec/timeSec/keyframes.t) são relativos a renderStart,
 * para continuarem válidos mesmo depois de um ajuste (trim) do corte.
 */
export interface ClipEditDecisions {
  version: 1;
  /** start_seconds no momento do render (segundos absolutos na fonte). */
  renderStart: number;
  orientation: Orientation;
  verticalMode: VerticalMode;
  /** Centro horizontal do recorte 9:16 (0–1) e keyframes de face tracking (t relativo a renderStart). */
  reframe: { centerX: number; keyframes?: { t: number; x: number }[] } | null;
  /** Centros (0–1) dos dois rostos no layout split_face. */
  splitCenters?: { top: number; bottom: number } | null;
  /** Intervalo do punch-in (zoom alternado) efetivamente aplicado, em segundos. */
  zoomPacingSec?: number | null;
  colorGrade: boolean;
  brolls: {
    offsetSec: number;
    durationSec: number;
    keyword: string;
    fileName: string;
    storagePath?: string | null;
    /** Caminho local (só durante o job; removido antes de gravar no banco). */
    localPath?: string;
  }[];
  sfx: { timeSec: number; type: "whoosh" | "pop" | "ding"; volume: number }[];
  /** Palavras do trecho em segundos absolutos (para gerar SRT editável). */
  words: { w: string; s: number; e: number }[];
  canvasBrolls?: CanvasBroll[];
}

export type CanvasBrollTemplate = "metric_counter" | "growth_chart" | "glass_alert" | "viral_tag";

export interface CanvasBrollData {
  title?: string;
  value?: string;
  subtitle?: string;
  color?: "cyan" | "green" | "yellow" | "purple";
  positionY?: "top" | "center" | "bottom";
}

export interface CanvasBroll {
  id: string;
  offsetSec: number;
  durationSec: number;
  template: CanvasBrollTemplate;
  data: CanvasBrollData;
}


