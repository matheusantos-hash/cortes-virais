export type JobStatus =
  | "queued"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "cutting"
  | "done"
  | "failed";

export interface Job {
  id: string;
  user_id: string;
  source_type: "link" | "drive" | "upload";
  source_url: string | null;
  source_path: string | null;
  orientation: "vertical" | "horizontal";
  crop_x: number;
  clip_count: number;
  min_seconds: number;
  max_seconds: number;
  language: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
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
}
