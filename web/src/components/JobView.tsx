"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtClock, isFinal, jobTitle } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Clip, Job } from "@/lib/types";
import StatusBadge from "./StatusBadge";

export default function JobView({ initialJob, initialClips }: { initialJob: Job; initialClips: Clip[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [job, setJob] = useState<Job>(initialJob);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: j } = await supabase.from("jobs").select("*").eq("id", initialJob.id).single();
    if (!j) return;
    setJob(j as Job);
    if (j.status === "done") {
      const { data: c } = await supabase.from("clips").select("*").eq("job_id", initialJob.id).order("position");
      if (c) setClips(c as Clip[]);
    }
  }, [supabase, initialJob.id]);

  useEffect(() => {
    if (isFinal(job.status)) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [job.status, refresh]);

  // Links temporários para reproduzir os clipes (bucket privado)
  useEffect(() => {
    const paths = clips.map((c) => c.file_path).filter((p): p is string => !!p && !urls[p]);
    if (!paths.length) return;
    supabase.storage
      .from("clips")
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (!data) return;
        setUrls((prev) => {
          const next = { ...prev };
          data.forEach((d) => {
            if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
          });
          return next;
        });
      });
  }, [clips, supabase, urls]);

  async function download(clip: Clip) {
    if (!clip.file_path) return;
    setDownloading(clip.id);
    const name = `corte-${String(clip.position).padStart(2, "0")}.mp4`;
    const { data } = await supabase.storage.from("clips").createSignedUrl(clip.file_path, 300, { download: name });
    setDownloading(null);
    if (data?.signedUrl) window.location.href = data.signedUrl;
  }

  const vertical = job.orientation === "vertical";

  return (
    <div className="stack-lg">
      <div className="stack">
        <h1 className="ellipsis">{jobTitle(job)}</h1>
        <div className="row">
          <StatusBadge status={job.status} />
          <span className="muted small">{clips.length > 0 ? `${clips.length} clipes` : ""}</span>
        </div>
        {!isFinal(job.status) && (
          <div className="bar">
            <div className="bar-fill" style={{ width: `${job.progress}%` }} />
          </div>
        )}
        {job.status === "failed" && <p className="error">{job.error ?? "Falha ao processar."}</p>}
      </div>

      <div className="clips">
        {clips.map((clip) => {
          const src = clip.file_path ? urls[clip.file_path] : undefined;
          return (
            <article key={clip.id} className="card clip">
              {src ? (
                <video src={src} controls preload="metadata" className={vertical ? "vid vertical" : "vid"} />
              ) : (
                <div className={vertical ? "vid vertical placeholder" : "vid placeholder"}>Carregando…</div>
              )}
              <h3>
                {clip.position}. {clip.title}
              </h3>
              <div className="muted small">
                {fmtClock(clip.start_seconds)}–{fmtClock(clip.end_seconds)} ·{" "}
                {Math.round(Number(clip.end_seconds) - Number(clip.start_seconds))} s
                {clip.score != null && ` · nota ${clip.score}`}
              </div>
              {clip.hook && <p className="small">“{clip.hook}”</p>}
              <button className="btn btn-small" onClick={() => download(clip)} disabled={downloading === clip.id}>
                {downloading === clip.id ? "Preparando…" : "Baixar"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
