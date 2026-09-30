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

/** O que o Claude devolve: índices de blocos, não segundos. */
export interface ClipCandidate {
  startIndex: number;
  endIndex: number;
  title: string;
  hook: string;
  score: number;
  reason: string;
}

export interface Clip {
  title: string;
  hook: string;
  score: number;
  reason: string;
  start: number;
  end: number;
}

export type Orientation = "vertical" | "horizontal";
export type VerticalMode = "blur" | "crop" | "split";
export type ReferenceType = "link" | "upload" | "preset" | "none";

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
  force: boolean;
  dryRun: boolean;
}
