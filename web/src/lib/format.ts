import type { Job, JobStatus } from "./types";

export const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "Na fila",
  downloading: "Obtendo o vídeo",
  transcribing: "Transcrevendo",
  analyzing: "Escolhendo os trechos",
  cutting: "Cortando os clipes",
  done: "Pronto",
  failed: "Falhou",
  canceled: "Cancelado",
};

export const isFinal = (s: JobStatus) => s === "done" || s === "failed" || s === "canceled";

export function fmtClock(sec: number): string {
  const s = Math.floor(Number(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Nome amigável do job: host do link ou nome do arquivo enviado. */
export function jobTitle(job: Job): string {
  if (job.source_type === "upload" && job.source_path) {
    const name = job.source_path.split("/").pop() ?? "arquivo";
    return name.replace(/^[0-9a-f-]{36}-/, "");
  }
  if (job.source_url) {
    try {
      const u = new URL(job.source_url);
      return u.hostname.replace(/^www\./, "") + u.pathname.slice(0, 30) + (u.search ? "…" : "");
    } catch {
      return job.source_url.slice(0, 50);
    }
  }
  return "Vídeo";
}
