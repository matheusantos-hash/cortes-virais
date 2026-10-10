"use client";

import { useState, useMemo } from "react";
import type { Job } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Cpu, Clock, Film, HardDrive, FileText, CheckCircle, TrendingUp, Calendar, Link as LinkIcon, Upload as UploadIcon, Smartphone, Monitor } from "lucide-react";

interface Props {
  jobs: Job[];
}

import { type Period } from "@/lib/types";
import { periodStart } from "@/lib/format";
type StatusFilter = "all" | "done" | "failed" | "canceled" | "running";



/** Estima tamanho do vídeo processado em MB baseado na duração */
function estimateSizeMB(durationSec: number): number {
  // ~5 Mbps para vídeo HD típico do YouTube
  return Math.round((durationSec * 5 * 1_000_000) / 8 / 1_048_576);
}

/** Calcula duração do job em segundos */
function jobDuration(j: Job): number | null {
  if (!j.started_at || !j.finished_at) return null;
  return (new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000;
}

export default function ResourcesTab({ jobs }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "link" | "upload">("all");

  const filtered = useMemo(() => {
    const cutoff = periodStart(period);
    return jobs.filter((j) => {
      if (cutoff && new Date(j.created_at) < cutoff) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "running") {
          if (["done", "failed", "canceled"].includes(j.status)) return false;
        } else if (j.status !== statusFilter) return false;
      }
      if (sourceFilter !== "all" && j.source_type !== sourceFilter) return false;
      return true;
    });
  }, [jobs, period, statusFilter, sourceFilter]);

  // Métricas de recursos
  const metrics = useMemo(() => {
    const done = filtered.filter((j) => j.status === "done" && j.started_at && j.finished_at);
    const durations = done.map((j) => jobDuration(j)!).filter(Boolean);
    const totalProcessSec = durations.reduce((a, b) => a + b, 0);
    const avgProcessSec = durations.length ? totalProcessSec / durations.length : 0;

    // Estima banda: soma de clips_count * avg_clip_size
    // cada clipe ~30s de vídeo comprimido ≈ ~15 MB
    const totalClips = filtered.reduce((a, j) => a + (j.clip_count ?? 0), 0);
    const estimatedStorageMB = totalClips * 15;

    // Jobs por dia (últimos 30)
    const byDay = new Map<string, number>();
    filtered.forEach((j) => {
      const day = j.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    });
    const dailySorted = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30);

    return {
      total: filtered.length,
      done: done.length,
      totalProcessSec,
      avgProcessSec,
      totalClips,
      estimatedStorageMB,
      dailySorted,
    };
  }, [filtered]);

  // Para a tabela de jobs com mais consumo
  const heavyJobs = useMemo(() => {
    return [...filtered]
      .filter((j) => j.started_at && j.finished_at)
      .sort((a, b) => (jobDuration(b) ?? 0) - (jobDuration(a) ?? 0))
      .slice(0, 20);
  }, [filtered]);

  function formatDuration(sec: number): string {
    if (sec < 60) return `${Math.round(sec)}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

  const maxDay = Math.max(...metrics.dailySorted.map(([, v]) => v), 1);

  return (
    <div className="admin-tab-content">
      {/* Filtros */}
      <div className="admin-filters">
        <div className="admin-filter-group">
          {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
            <button key={p} className={`filter-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>
              {p === "all" ? "Tudo" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
        </div>
        <div className="admin-filter-group">
          {(["all", "done", "failed", "running"] as StatusFilter[]).map((s) => (
            <button key={s} className={`filter-btn ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
              {s === "all" ? "Todos status" : s === "done" ? "✅ Concluídos" : s === "failed" ? "❌ Falhas" : "⏳ Em andamento"}
            </button>
          ))}
        </div>
        <div className="admin-filter-group">
          {(["all", "link", "upload"] as const).map((s) => (
            <button key={s} className={`filter-btn ${sourceFilter === s ? "active" : ""}`} onClick={() => setSourceFilter(s)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              {s === "all" ? "Toda origem" : s === "link" ? <><LinkIcon size={12} /> Link</> : <><UploadIcon size={12} /> Upload</>}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="resource-cards">
        <div className="resource-card">
          <div className="rc-icon"><Cpu size={22} style={{ color: "var(--primary)" }} /></div>
          <div className="rc-value">{formatDuration(metrics.totalProcessSec)}</div>
          <div className="rc-label">Tempo total de processamento</div>
        </div>
        <div className="resource-card">
          <div className="rc-icon"><Clock size={22} style={{ color: "var(--primary)" }} /></div>
          <div className="rc-value">{formatDuration(metrics.avgProcessSec)}</div>
          <div className="rc-label">Tempo médio por job</div>
        </div>
        <div className="resource-card">
          <div className="rc-icon"><Film size={22} style={{ color: "var(--primary)" }} /></div>
          <div className="rc-value">{metrics.totalClips}</div>
          <div className="rc-label">Clipes gerados no período</div>
        </div>
        <div className="resource-card">
          <div className="rc-icon"><HardDrive size={22} style={{ color: "var(--primary)" }} /></div>
          <div className="rc-value">~{metrics.estimatedStorageMB >= 1024 ? `${(metrics.estimatedStorageMB / 1024).toFixed(1)} GB` : `${metrics.estimatedStorageMB} MB`}</div>
          <div className="rc-label">Armazenamento estimado (clipes)</div>
        </div>
        <div className="resource-card">
          <div className="rc-icon"><FileText size={22} style={{ color: "var(--primary)" }} /></div>
          <div className="rc-value">{metrics.total}</div>
          <div className="rc-label">Jobs no período</div>
        </div>
        <div className="resource-card">
          <div className="rc-icon"><CheckCircle size={22} style={{ color: "var(--primary)" }} /></div>
          <div className="rc-value">{metrics.done}</div>
          <div className="rc-label">Jobs concluídos</div>
        </div>
      </div>

      {/* Gráfico de barras: jobs por dia */}
      {metrics.dailySorted.length > 0 && (
        <div className="chart-section">
          <h3 className="chart-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Calendar size={18} style={{ color: "var(--primary)" }} /> Jobs por dia
          </h3>
          <div className="bar-chart">
            {metrics.dailySorted.map(([day, count]) => (
              <div key={day} className="bar-col">
                <div className="bar-label-count">{count}</div>
                <div
                  className="bar-fill"
                  style={{ height: `${Math.round((count / maxDay) * 100)}%` }}
                  title={`${day}: ${count} jobs`}
                />
                <div className="bar-label-day">{day.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela: jobs mais pesados */}
      <div className="chart-section">
        <h3 className="chart-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <TrendingUp size={18} style={{ color: "var(--accent)" }} />
          Jobs com maior tempo de processamento
        </h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Formato</th>
                <th>Clipes</th>
                <th>Tempo processamento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {heavyJobs.map((j) => {
                const dur = jobDuration(j);
                return (
                  <tr key={j.id}>
                    <td className="td-muted">{fmtDate(j.created_at)}</td>
                    <td>
                      <span className="source-badge" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        {j.source_type === "link" ? <><LinkIcon size={12} /> Link</> : <><UploadIcon size={12} /> Upload</>}
                      </span>
                    </td>
                    <td className="td-muted" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      {j.orientation === "vertical" ? <><Smartphone size={13} /> 9:16</> : <><Monitor size={13} /> 16:9</>}
                    </td>
                    <td>{j.clip_count ?? "—"}</td>
                    <td className="td-mono">{dur ? formatDuration(dur) : "—"}</td>
                    <td>
                      <span className={`status-pill status-${j.status}`}>{j.status}</span>
                    </td>
                  </tr>
                );
              })}
              {heavyJobs.length === 0 && (
                <tr><td colSpan={6} className="td-empty">Nenhum job concluído no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
