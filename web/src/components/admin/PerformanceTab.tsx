"use client";

import { useState, useMemo } from "react";
import type { Job } from "@/lib/types";
import type { AdminUsuario } from "@/app/admin/page";
import { fmtDate } from "@/lib/format";
import { adminDeleteJob } from "@/app/admin/actions";
import {
  UsersIcon,
  SmartphoneIcon,
  MonitorIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  Link as LinkIcon,
  Upload as UploadIcon,
  Trash2 as TrashIcon,
  TrendingUp,
  Layers,
} from "@/components/Icons";

interface Props {
  jobs: Job[];
  users: AdminUsuario[];
}

type Period = "7d" | "30d" | "90d" | "all";

function periodStart(p: Period): Date | null {
  if (p === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - { "7d": 7, "30d": 30, "90d": 90 }[p]);
  return d;
}

export default function PerformanceTab({ jobs, users }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<"all" | "vertical" | "horizontal">("all");
  const [taskFilter, setTaskFilter] = useState<"all" | "link" | "upload">("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  const emailOf = useMemo(() => new Map(users.map((u) => [u.id, u.email ?? "—"])), [users]);

  const filtered = useMemo(() => {
    const cutoff = periodStart(period);
    return jobs.filter((j) => {
      if (cutoff && new Date(j.created_at) < cutoff) return false;
      if (userFilter !== "all" && j.user_id !== userFilter) return false;
      if (deviceFilter !== "all" && j.orientation !== deviceFilter) return false;
      if (taskFilter !== "all" && j.source_type !== taskFilter) return false;
      return true;
    });
  }, [jobs, period, userFilter, deviceFilter, taskFilter]);

  // Taxas globais
  const total = filtered.length;
  const done = filtered.filter((j) => j.status === "done").length;
  const failed = filtered.filter((j) => j.status === "failed").length;
  const canceled = filtered.filter((j) => j.status === "canceled").length;
  const running = total - done - failed - canceled;
  const successRate = total > 0 ? ((done / total) * 100).toFixed(1) : "—";
  const failRate = total > 0 ? ((failed / total) * 100).toFixed(1) : "—";

  // Por usuário
  const byUser = useMemo(() => {
    const map = new Map<string, { total: number; done: number; failed: number }>();
    filtered.forEach((j) => {
      const s = map.get(j.user_id) ?? { total: 0, done: 0, failed: 0 };
      s.total++;
      if (j.status === "done") s.done++;
      if (j.status === "failed") s.failed++;
      map.set(j.user_id, s);
    });
    return [...map.entries()]
      .map(([uid, s]) => ({ uid, email: emailOf.get(uid) ?? uid.slice(0, 8), ...s }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [filtered, emailOf]);

  // Por formato/dispositivo
  const byDevice = useMemo(() => {
    const map = new Map<string, { total: number; done: number; failed: number }>();
    filtered.forEach((j) => {
      const key = j.orientation ?? "unknown";
      const s = map.get(key) ?? { total: 0, done: 0, failed: 0 };
      s.total++;
      if (j.status === "done") s.done++;
      if (j.status === "failed") s.failed++;
      map.set(key, s);
    });
    return [...map.entries()].map(([key, s]) => ({ key, ...s }));
  }, [filtered]);

  // Por tarefa (source_type)
  const byTask = useMemo(() => {
    const map = new Map<string, { total: number; done: number; failed: number }>();
    filtered.forEach((j) => {
      const key = j.source_type ?? "unknown";
      const s = map.get(key) ?? { total: 0, done: 0, failed: 0 };
      s.total++;
      if (j.status === "done") s.done++;
      if (j.status === "failed") s.failed++;
      map.set(key, s);
    });
    return [...map.entries()].map(([key, s]) => ({ key, ...s }));
  }, [filtered]);

  // Erros agrupados
  const errorGroups = useMemo(() => {
    const map = new Map<string, { count: number; lastSeen: string; jobIds: string[] }>();
    filtered
      .filter((j) => j.status === "failed" && j.error)
      .forEach((j) => {
        // Normaliza mensagem de erro (remove IDs/números variáveis)
        const key = (j.error ?? "Erro desconhecido")
          .replace(/[a-f0-9-]{36}/g, "{uuid}")
          .replace(/\d+/g, "N")
          .slice(0, 120);
        const s = map.get(key) ?? { count: 0, lastSeen: j.created_at, jobIds: [] };
        s.count++;
        if (j.created_at > s.lastSeen) s.lastSeen = j.created_at;
        if (s.jobIds.length < 3) s.jobIds.push(j.id);
        map.set(key, s);
      });
    return [...map.entries()]
      .map(([msg, s]) => ({ msg, ...s }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  async function handleDelete(jobId: string) {
    if (!confirm("Excluir este job?")) return;
    setDeleting(jobId);
    await adminDeleteJob(jobId);
    setDeleting(null);
  }

  // Usuários únicos para filtro
  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>();
    return jobs
      .filter((j) => { if (seen.has(j.user_id)) return false; seen.add(j.user_id); return true; })
      .map((j) => ({ id: j.user_id, email: emailOf.get(j.user_id) ?? j.user_id.slice(0, 8) }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [jobs, emailOf]);

  return (
    <div className="admin-tab-content">
      {/* Filtros */}
      <div className="admin-filters wrap">
        <div className="admin-filter-group">
          {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
            <button key={p} className={`filter-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>
              {p === "all" ? "Tudo" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
        </div>
        <div className="admin-filter-group">
          <select className="admin-select" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="all">Todos usuários</option>
            {uniqueUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.email}</option>
            ))}
          </select>
        </div>
        <div className="admin-filter-group">
          {(["all", "vertical", "horizontal"] as const).map((d) => (
            <button
              key={d}
              className={`filter-btn ${deviceFilter === d ? "active" : ""}`}
              onClick={() => setDeviceFilter(d)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              {d === "all" ? (
                "Todos formatos"
              ) : d === "vertical" ? (
                <>
                  <SmartphoneIcon size={12} /> Vertical
                </>
              ) : (
                <>
                  <MonitorIcon size={12} /> Horizontal
                </>
              )}
            </button>
          ))}
        </div>
        <div className="admin-filter-group">
          {(["all", "link", "upload"] as const).map((t) => (
            <button
              key={t}
              className={`filter-btn ${taskFilter === t ? "active" : ""}`}
              onClick={() => setTaskFilter(t)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              {t === "all" ? (
                "Toda tarefa"
              ) : t === "link" ? (
                <>
                  <LinkIcon size={12} /> Link
                </>
              ) : (
                <>
                  <UploadIcon size={12} /> Upload
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de taxa de sucesso */}
      <div className="perf-overview">
        <div className="perf-card">
          <div className={`perf-rate ${parseFloat(successRate as string) >= 80 ? "good" : parseFloat(successRate as string) >= 50 ? "warn" : "bad"}`}>
            {successRate}%
          </div>
          <div className="perf-label">Taxa de sucesso</div>
          <div className="perf-sub">{done}/{total} jobs</div>
        </div>
        <div className="perf-card">
          <div className={`perf-rate ${parseFloat(failRate as string) <= 10 ? "good" : parseFloat(failRate as string) <= 30 ? "warn" : "bad"}`}>
            {failRate}%
          </div>
          <div className="perf-label">Taxa de falha</div>
          <div className="perf-sub">{failed} jobs com erro</div>
        </div>
        <div className="perf-card">
          <div className="perf-rate neutral">{canceled}</div>
          <div className="perf-label">Cancelados</div>
          <div className="perf-sub">pelo usuário</div>
        </div>
        <div className="perf-card">
          <div className="perf-rate neutral">{running}</div>
          <div className="perf-label">Em andamento</div>
          <div className="perf-sub">fila + processando</div>
        </div>
      </div>

      <div className="perf-grid">
        {/* Por usuário */}
        <div className="perf-section">
          <h3 className="perf-section-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <UsersIcon size={16} /> Por usuário
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Total</th>
                  <th title="Concluídos"><CheckCircleIcon size={14} style={{ color: "#10b981", verticalAlign: "middle" }} /></th>
                  <th title="Falhas"><AlertCircleIcon size={14} style={{ color: "#ef4444", verticalAlign: "middle" }} /></th>
                  <th>Taxa</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((u) => (
                  <tr key={u.uid}>
                    <td className="user-email-sm">{u.email}</td>
                    <td>{u.total}</td>
                    <td className="td-success">{u.done}</td>
                    <td className="td-danger">{u.failed}</td>
                    <td>
                      <div className="mini-bar-wrap">
                        <div className="mini-bar" style={{ width: `${u.total > 0 ? (u.done / u.total) * 100 : 0}%` }} />
                        <span className="mini-bar-pct">{u.total > 0 ? Math.round((u.done / u.total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {byUser.length === 0 && <tr><td colSpan={5} className="td-empty">Nenhum dado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Por dispositivo */}
        <div className="perf-section">
          <h3 className="perf-section-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <SmartphoneIcon size={16} /> Por formato
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>Formato</th>
                  <th>Total</th>
                  <th title="Concluídos"><CheckCircleIcon size={14} style={{ color: "#10b981", verticalAlign: "middle" }} /></th>
                  <th title="Falhas"><AlertCircleIcon size={14} style={{ color: "#ef4444", verticalAlign: "middle" }} /></th>
                </tr>
              </thead>
              <tbody>
                {byDevice.map((d) => (
                  <tr key={d.key}>
                    <td style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {d.key === "vertical" ? <><SmartphoneIcon size={13} /> Vertical</> : d.key === "horizontal" ? <><MonitorIcon size={13} /> Horizontal</> : d.key}
                    </td>
                    <td>{d.total}</td>
                    <td className="td-success">{d.done}</td>
                    <td className="td-danger">{d.failed}</td>
                  </tr>
                ))}
                {byDevice.length === 0 && <tr><td colSpan={4} className="td-empty">Nenhum dado.</td></tr>}
              </tbody>
            </table>
          </div>

          <h3 className="perf-section-title" style={{ marginTop: 24, display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Layers size={16} /> Por tarefa
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Total</th>
                  <th title="Concluídos"><CheckCircleIcon size={14} style={{ color: "#10b981", verticalAlign: "middle" }} /></th>
                  <th title="Falhas"><AlertCircleIcon size={14} style={{ color: "#ef4444", verticalAlign: "middle" }} /></th>
                </tr>
              </thead>
              <tbody>
                {byTask.map((t) => (
                  <tr key={t.key}>
                    <td style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {t.key === "link" ? <><LinkIcon size={13} /> Link</> : t.key === "upload" ? <><UploadIcon size={13} /> Upload</> : t.key}
                    </td>
                    <td>{t.total}</td>
                    <td className="td-success">{t.done}</td>
                    <td className="td-danger">{t.failed}</td>
                  </tr>
                ))}
                {byTask.length === 0 && <tr><td colSpan={4} className="td-empty">Nenhum dado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Erros agrupados */}
      <div className="chart-section">
        <h3 className="chart-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <AlertCircleIcon size={16} style={{ color: "#ef4444" }} /> Erros mais frequentes
        </h3>
        {errorGroups.length === 0 ? (
          <p className="td-empty" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <CheckCircleIcon size={15} style={{ color: "#10b981" }} /> Nenhum erro no período selecionado!
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Mensagem de erro</th><th>Ocorrências</th><th>Última vez</th></tr>
              </thead>
              <tbody>
                {errorGroups.map((eg, i) => (
                  <tr key={i}>
                    <td className="error-msg">{eg.msg}</td>
                    <td><span className="error-count">{eg.count}</span></td>
                    <td className="td-muted">{fmtDate(eg.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Jobs com falha recente */}
      <div className="chart-section">
        <h3 className="chart-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <AlertCircleIcon size={16} style={{ color: "#ef4444" }} /> Jobs com falha (recentes)
        </h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Data</th><th>Usuário</th><th>Tipo</th><th>Formato</th><th>Erro</th><th></th></tr>
            </thead>
            <tbody>
              {filtered
                .filter((j) => j.status === "failed")
                .slice(0, 50)
                .map((j) => (
                  <tr key={j.id}>
                    <td className="td-muted">{fmtDate(j.created_at)}</td>
                    <td className="user-email-sm">{emailOf.get(j.user_id) ?? "—"}</td>
                    <td>
                      <span className="source-badge" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        {j.source_type === "link" ? <LinkIcon size={12} /> : <UploadIcon size={12} />} {j.source_type}
                      </span>
                    </td>
                    <td className="td-muted" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      {j.orientation === "vertical" ? <SmartphoneIcon size={13} /> : <MonitorIcon size={13} />} {j.orientation}
                    </td>
                    <td className="error-msg-sm">{j.error ?? "—"}</td>
                    <td>
                      <button
                        className="admin-btn-sm danger"
                        disabled={deleting === j.id}
                        onClick={() => handleDelete(j.id)}
                        title="Excluir"
                      >
                        {deleting === j.id ? "…" : <TrashIcon size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              {filtered.filter((j) => j.status === "failed").length === 0 && (
                <tr>
                  <td colSpan={6} className="td-empty" style={{ textAlign: "center" }}>
                    <CheckCircleIcon size={14} style={{ color: "#10b981", verticalAlign: "middle", marginRight: "4px" }} /> Nenhum job com falha no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
