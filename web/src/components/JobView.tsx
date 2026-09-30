"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelJob } from "@/app/actions";
import { fmtClock, isFinal, jobTitle } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Clip, Job } from "@/lib/types";
import PowerShellTerminal from "./PowerShellTerminal";
import StatusBadge from "./StatusBadge";
import {
  DownloadIcon,
  FlameIcon,
  SparklesIcon,
  SmartphoneIcon,
  MonitorIcon,
  XIcon,
} from "./Icons";

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
    <div className="stack-lg" style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div className="row">
        <Link href="/" className="btn btn-small btn-secondary">
          ← Voltar ao Painel
        </Link>
        <span className="muted small">ID: {job.id}</span>
      </div>

      <div className="card stack">
        <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div className="row" style={{ justifyContent: "flex-start", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <StatusBadge status={job.status} />
              <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>
                {vertical ? "📱 9:16 Vertical" : "🖥️ 16:9 Horizontal"}
              </span>
              <span className="muted small">{clips.length > 0 ? `${clips.length} clipes` : ""}</span>
            </div>
            <h1 className="ellipsis" style={{ fontSize: "1.4rem", margin: 0 }}>{jobTitle(job)}</h1>
          </div>

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

        {!isFinal(job.status) && (
          <div className="bar">
            <div className="bar-fill" style={{ width: `${Math.max(job.progress, 5)}%` }} />
          </div>
        )}

        {job.status === "failed" && <p className="error">❌ {job.error ?? "Falha ao processar o vídeo."}</p>}
        {job.status === "canceled" && <p className="muted" style={{ color: "var(--warning)" }}>⚠️ Processamento cancelado pelo usuário.</p>}

        {/* Informações de Design e Referência */}
        {(job.reference_style || job.reference_url || job.design_instructions || job.vertical_mode) && (
          <div className="card" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", fontSize: "0.88rem", padding: "0.75rem 1rem" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              {job.vertical_mode && (
                <span>
                  <strong>Layout:</strong> {job.vertical_mode === "crop" ? "📱 Crop 9:16" : job.vertical_mode === "blur" ? "🎞️ Fundo Blur" : "🎙️ Split Screen"}
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
              <div style={{ marginTop: "0.3rem", color: "var(--text-muted)" }}>
                <strong>Diretrizes:</strong> “{job.design_instructions}”
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal PowerShell do Backend */}
      <section className="stack">
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600 }}>Andamento do Processo (Terminal ao Vivo)</h2>
        <PowerShellTerminal logs={job.logs ?? []} status={job.status} jobId={job.id} />
      </section>

      {/* Grade de Clipes Gerados */}
      {job.status === "done" && (
        <section className="stack">
          <div className="row">
            <h2>Clipes Gerados pela IA ({clips.length})</h2>
          </div>

          <div className="clips-grid">
            {clips.map((clip) => {
              const src = clip.file_path ? urls[clip.file_path] : undefined;
              const durationSec = Math.round(Number(clip.end_seconds) - Number(clip.start_seconds));

              return (
                <div key={clip.id} className="clip-card">
                  {src ? (
                    <video src={src} controls preload="metadata" className={vertical ? "vid vertical" : "vid"} />
                  ) : (
                    <div className={vertical ? "vid vertical placeholder" : "vid placeholder"}>Carregando vídeo…</div>
                  )}

                  <div className="row" style={{ marginTop: "0.2rem" }}>
                    <span className="badge-viral">
                      <FlameIcon size={14} />
                      {clip.score ?? 95}/100
                    </span>
                    <span className="muted small">
                      {fmtClock(clip.start_seconds)}–{fmtClock(clip.end_seconds)} ({durationSec}s)
                    </span>
                  </div>

                  <h4 style={{ fontSize: "1rem", lineHeight: 1.35, margin: 0, fontWeight: 700 }}>
                    {clip.position}. {clip.title}
                  </h4>

                  {clip.hook && (
                    <p className="clip-hook" title="Gancho inicial forte detectado pela IA">
                      <strong>Gancho:</strong> &ldquo;{clip.hook}&rdquo;
                    </p>
                  )}

                  {clip.reason && (
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                      <strong>Por que viraliza:</strong> {clip.reason}
                    </p>
                  )}

                  <button
                    type="button"
                    className="btn-cta"
                    style={{ padding: "0.6rem 1rem", fontSize: "0.88rem", marginTop: "auto" }}
                    onClick={() => download(clip)}
                    disabled={downloading === clip.id}
                  >
                    <DownloadIcon size={16} />
                    <span>{downloading === clip.id ? "Preparando…" : "Baixar Clipe MP4"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
