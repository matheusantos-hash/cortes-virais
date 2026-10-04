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

export interface Job {
  id: string;
  user_id: string;
  source_type: "link" | "drive" | "upload";
  source_url: string | null;
  source_path: string | null;
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
  broll_source?: "pexels" | "higgsfield" | "none";
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
}
