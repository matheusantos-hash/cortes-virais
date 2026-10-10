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
  transcription_provider?: "deepgram" | "gemini" | "auto";
  custom_font_path?: string | null;
  custom_font_name?: string | null;
  enable_sfx?: boolean;
  enable_emojis?: boolean;
  enable_visual_analysis?: boolean;
  enable_extended_thinking?: boolean;
  status: JobStatus;
  progress: number;
  error: string | null;
  logs?: string[];
  created_at: string;
  started_at: string | null;
  finished_at?: string | null;
  clips?: Clip[];
  job_type?: "full" | "trim";
  canvas_brolls?: CanvasBroll[];
  project_id?: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  thumbnail_url?: string | null;
  color_tag?: string;
  created_at: string;
  updated_at?: string;
  jobs?: Job[];
  clips_count?: number;
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
    customFontPath?: string | null;
    customFontName?: string | null;
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
  camera?: {
    verticalMode?: "face_tracking" | "crop" | "blur" | "split" | "split_face";
    dynamicZoom?: boolean;
  };
  aiCuration?: {
    enableVisualAnalysis?: boolean;
    enableExtendedThinking?: boolean;
    thinkingBudgetTokens?: number;
  };
  learning_metrics?: StyleLearningMetrics;
}

export interface ExportSettings {
  resolution?: "1080x1920" | "2160x3840" | "1920x1080" | "1080x1080";
  codec?: "h264" | "hevc" | "prores422";
  fps?: 24 | 30 | 60;
  bitrate?: "master" | "high" | "standard";
  audioNormalization?: boolean; // EBU R128 (-14 LUFS)
  generateNleTimeline?: boolean; // XML / EDL
}

export interface StyleLearningMetrics {
  status?: "pending" | "learning" | "ready" | "failed";
  progress?: number;
  avgCutPacingSec?: number;
  detectedFontFamily?: string;
  detectedColors?: { primary: string; highlight: string; stroke?: string };
  detectedPosition?: "bottom" | "center-bottom" | "center";
  cameraFramingPattern?: "single_speaker_punch_in" | "face_tracking" | "dynamic_multicam" | "split_screen";
  sfxDensityPerMinute?: number;
  subtitleMaxWordsPerLine?: number;
  sampleVideoNames?: string[];
  sampleSubtitleNames?: string[];
  accuracyScore?: number;
  trainingSamplesCount?: number;
}

export interface SavedReference {
  id: string;
  user_id?: string;
  name: string;
  reference_type: "upload" | "link" | "preset";
  reference_url?: string | null;
  reference_path?: string | null;
  custom_font_path?: string | null;
  custom_font_name?: string | null;
  style_category?: string;
  subtitle_style?: SubtitleStyle;
  design_instructions?: string | null;
  manual_adjustments?: ManualAdjustments;
  export_settings?: ExportSettings;
  learning_status?: "pending" | "learning" | "ready" | "failed";
  learning_metrics?: StyleLearningMetrics;
  sample_videos?: string[];
  sample_subtitles?: string[];
  created_at?: string;
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

export interface Clip {
  id: string;
  job_id: string;
  user_id?: string;
  position: number;
  title: string;
  hook: string | null;
  reason: string | null;
  score: number | null;
  visual_context?: string | null;
  start_seconds: number;
  end_seconds: number;
  file_path: string | null;
  thumbnail_url?: string | null;
  version?: number;
  is_trimming?: boolean;
  edit_decisions?: ClipEditDecisions | null;
  canvas_brolls?: CanvasBroll[];
  created_at?: string;
}



export type Period = "7d" | "30d" | "90d" | "all";
