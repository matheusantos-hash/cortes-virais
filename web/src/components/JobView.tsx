"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelJob } from "@/app/actions";
import { fmtClock, isFinal, jobTitle } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Clip, Job } from "@/lib/types";
import PowerShellTerminal from "./PowerShellTerminal";
import StatusBadge from "./StatusBadge";

export default function JobView({ initialJob, initialClips }: { initialJob: Job; initialClips: Clip[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [job, setJob] = useState<Job>(initialJob);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const refresh = useCallback(async () => {
    const { data: j } = await supabase.from("jobs").select("*").eq("id", initialJob.id).single();
    if (!j) return;
    setJob(j as Job);
    if (j.status === "done") {
      const { data: c } = await supabase.from("clips").select("*").eq("job_id", initialJob.id).order("position");
      if (c) setClips(c as Clip[]);
    }
  }, [supabase, initialJob.id]);

  // Realtime subscription para receber novos logs e atualizações de status instantaneamente
  useEffect(() => {
    const channel = supabase
      .channel(`job-detail-${initialJob.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${initialJob.id}` }, (payload) => {
        if (payload.new) {
          setJob(payload.new as Job);
          if ((payload.new as Job).status === "done") {
            refresh();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initialJob.id, refresh]);

  useEffect(() => {
    if (isFinal(job.status)) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [job.status, refresh]);

  async function handleCancel() {
    if (!confirm("Tem certeza que deseja cancelar o processamento deste vídeo?")) return;
    setCanceling(true);
    try {
      const res = await cancelJob(job.id);
      if (res && !res.success && res.error) {
        alert(`Não foi possível cancelar: ${res.error}`);
        return;
      }
      setJob((prev) => ({
        ...prev,
        status: "canceled",
        error: "Cancelado pelo usuário.",
      }));
      await refresh();
    } catch (err: any) {
      console.error("Falha ao cancelar:", err);
      alert(`Erro inesperado ao cancelar: ${err?.message || "Tente novamente."}`);
    } finally {
      setCanceling(false);
    }
  }

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
        <div className="row">
          <h1 className="ellipsis" style={{ margin: 0 }}>{jobTitle(job)}</h1>
          {!isFinal(job.status) && (
            <button
              type="button"
              className="btn btn-small btn-danger-outline"
              onClick={handleCancel}
              disabled={canceling}
              title="Interromper e cancelar o processamento deste vídeo"
            >
              {canceling ? "Cancelando…" : "✕ Cancelar Processo"}
            </button>
          )}
        </div>
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
        {job.status === "canceled" && <p className="muted" style={{ color: "#d97706" }}>Processamento cancelado pelo usuário.</p>}

        {/* Informações de Design e Referência */}
        {(job.reference_style || job.reference_url || job.design_instructions || job.vertical_mode) && (
          <div className="card" style={{ background: "rgba(0,0,0,0.02)", fontSize: "0.88rem", padding: "0.75rem 1rem" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              {job.vertical_mode && (
                <span>
                  <strong>Layout:</strong> {job.vertical_mode === "crop" ? "📱 Crop 9:16" : job.vertical_mode === "blur" ? "🎞️ Fundo Desfocado (Blur)" : "🎙️ Split Screen"}
                </span>
              )}
              {job.reference_style && (
                <span>
                  <strong>Estilo:</strong> {job.reference_style}
                </span>
              )}
            </div>
            {job.reference_url && (
              <div style={{ marginTop: "0.3rem" }}>
                <strong>Vídeo de Referência:</strong>{" "}
                <a href={job.reference_url} target="_blank" rel="noopener noreferrer" className="link" style={{ wordBreak: "break-all" }}>
                  {job.reference_url}
                </a>
              </div>
            )}
            {job.design_instructions && (
              <div style={{ marginTop: "0.3rem", color: "var(--muted)" }}>
                <strong>Diretrizes:</strong> “{job.design_instructions}”
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal PowerShell do Backend */}
      <section className="stack">
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600 }}>Andamento do Processo (Terminal)</h2>
        <PowerShellTerminal logs={job.logs ?? []} status={job.status} jobId={job.id} />
      </section>

      {job.status === "done" && (
        <section className="stack">
          <h2>Clipes Gerados</h2>
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
        </section>
      )}
    </div>
  );
}
