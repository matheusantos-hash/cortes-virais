export type JobStatus =
  | "queued"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "cutting"
  | "done"
  | "failed"
  | "canceled";

export type VerticalMode = "crop" | "blur" | "split" | "face_tracking" | "split_face";
export type SubtitleStyle = "hormozi" | "beast" | "apple" | "minimal";

export interface SourceMeta {
  fileName: string;
  durationSec: number;
  fpsNum: number;
  fpsDen: number;
  width: number;
  height: number;
  startTimecode: string | null;
  audioChannels: number;
  audioSampleRate: number;
  videoCodec: string | null;
  vfr: boolean;
}

export interface ClipEditDecisions {
  version: 1;
  renderStart: number;
  orientation: "vertical" | "horizontal";
  verticalMode: VerticalMode;
  reframe: { centerX: number; keyframes?: { t: number; x: number }[] } | null;
  splitCenters?: { top: number; bottom: number } | null;
  zoomPacingSec?: number | null;
  colorGrade: boolean;
  brolls: {
    offsetSec: number;
    durationSec: number;
    keyword: string;
    fileName: string;
    storagePath?: string | null;
  }[];
  sfx: { timeSec: number; type: "whoosh" | "pop" | "ding"; volume: number }[];
  words: { w: string; s: number; e: number }[];
}

export interface Job {
  id: string;
  user_id: string;
  source_type: "link" | "drive" | "upload";
  file_name?: string | null;
  source_url: string | null;
  source_path: string | null;
  source_meta?: SourceMeta | null;
  orientation: "vertical" | "horizontal";
  vertical_mode?: VerticalMode;
  crop_x: number;
  clip_count: number;
  min_seconds: number;
  max_seconds: number;
  language: string;
  reference_type?: "link" | "upload" | "preset" | "none";
  reference_url?: string | null;
  reference_path?: string | null;
  reference_style?: string | null;
  design_instructions?: string | null;
  use_broll?: boolean;
  broll_source?: "auto" | "pexels" | "higgsfield" | "none";
  subtitle_style?: SubtitleStyle;
  enable_sfx?: boolean;
  enable_emojis?: boolean;
  status: JobStatus;
  progress: number;
  error: string | null;
  logs?: string[];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  clips?: Clip[];
  job_type?: "full" | "trim";
}

export interface ManualAdjustments {
  subtitles?: {
    style?: SubtitleStyle;
    fontSize?: "medium" | "large" | "extra";
    primaryColor?: string;
    highlightColor?: string;
    positionY?: "bottom" | "center-bottom" | "center";
    enableEmojis?: boolean;
    karaokeHighlight?: boolean;
  };
  keyMoments?: {
    hookSensitivity?: "extreme" | "balanced" | "subtle";
    cutPacing?: "ultra_fast" | "dynamic" | "smooth";
    removeSilences?: boolean;
    smartPunchInZoom?: boolean;
  };
  soundDesign?: {
    enableSfx?: boolean;
    backgroundMusicDucking?: boolean;
    sfxVolume?: number;
  };
  brolls?: {
    enabled?: boolean;
    source?: "auto" | "pexels" | "higgsfield" | "none";
    frequency?: "high" | "medium" | "low";
  };
}

export interface ExportSettings {
  resolution?: "1080x1920" | "2160x3840" | "1920x1080" | "1080x1080";
  codec?: "h264" | "hevc" | "prores422";
  fps?: 24 | 30 | 60;
  bitrate?: "master" | "high" | "standard";
  audioNormalization?: boolean; // EBU R128 (-14 LUFS)
  generateNleTimeline?: boolean; // XML / EDL
}

export interface SavedReference {
  id: string;
  user_id?: string;
  name: string;
  reference_type: "upload" | "link" | "preset";
  reference_url?: string | null;
  reference_path?: string | null;
  style_category?: string;
  subtitle_style?: SubtitleStyle;
  design_instructions?: string | null;
  manual_adjustments?: ManualAdjustments;
  export_settings?: ExportSettings;
  created_at?: string;
}

export interface Clip {
  id: string;
  job_id: string;
  position: number;
  title: string;
  hook: string | null;
  reason: string | null;
  score: number | null;
  start_seconds: number;
  end_seconds: number;
  file_path: string | null;
  thumbnail_url?: string | null;
  version?: number;
  is_trimming?: boolean;
  edit_decisions?: ClipEditDecisions | null;
}

