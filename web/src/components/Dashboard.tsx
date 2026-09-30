"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDate, isFinal, jobTitle } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/lib/types";
import NewJobForm from "./NewJobForm";
import StatusBadge from "./StatusBadge";

export default function Dashboard({ userId, initialJobs }: { userId: string; initialJobs: Job[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setJobs(data as Job[]);
  }, [supabase]);

  // Progresso ao vivo (Realtime)
  useEffect(() => {
    const channel = supabase
      .channel("jobs-do-usuario")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${userId}` }, () =>
        refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, refresh]);

  // Plano B: se o Realtime falhar, atualiza a cada poucos segundos enquanto houver job rodando
  const hasActive = jobs.some((j) => !isFinal(j.status));
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [hasActive, refresh]);

  return (
    <div className="stack-lg">
      <NewJobForm userId={userId} onCreated={refresh} />

      <section className="stack">
        <h2>Meus pedidos</h2>
        {jobs.length === 0 && <p className="muted">Nenhum pedido ainda. Cole um link acima para começar.</p>}
        {jobs.map((job) => (
          <article key={job.id} className="card job">
            <div className="row">
              <strong className="ellipsis">{jobTitle(job)}</strong>
              <StatusBadge status={job.status} />
            </div>
            <div className="muted small">
              {fmtDate(job.created_at)} · {job.orientation === "vertical" ? "vertical" : "horizontal"} · {job.clip_count} clipes
            </div>
            {!isFinal(job.status) && (
              <div className="bar">
                <div className="bar-fill" style={{ width: `${job.progress}%` }} />
              </div>
            )}
            {job.status === "failed" && <p className="error">{job.error ?? "Falha ao processar."}</p>}
            {job.status === "done" && (
              <Link className="btn btn-small" href={`/jobs/${job.id}`}>
                Ver clipes
              </Link>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
