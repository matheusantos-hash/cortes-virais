"use client";

import { useState, useTransition } from "react";
import type { AdminUsuario } from "@/app/admin/page";
import type { Job } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { setAdminFlag, setUserPlan, setUserCredits, adminDeleteJob } from "@/app/admin/actions";

interface Props {
  users: AdminUsuario[];
  jobs: Job[];
}

export default function UsersTab({ users, jobs }: Props) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<"all" | "pagante" | "free">("all");
  const [editingUser, setEditingUser] = useState<AdminUsuario | null>(null);
  const [creditsVal, setCreditsVal] = useState<number>(30);
  const [limitVal, setLimitVal] = useState<number>(60);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Mapa de jobs por usuário
  const jobsByUser = new Map<string, Job[]>();
  jobs.forEach((j) => {
    const arr = jobsByUser.get(j.user_id) ?? [];
    arr.push(j);
    jobsByUser.set(j.user_id, arr);
  });

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.id.includes(search);
    const matchPlan =
      filterPlan === "all" ||
      (filterPlan === "pagante" && u.pagante) ||
      (filterPlan === "free" && !u.pagante);
    return matchSearch && matchPlan;
  });

  function showMsg(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  function handleOpenEdit(u: AdminUsuario) {
    setEditingUser(u);
    setCreditsVal(Number(u.creditos_minutos ?? 30));
    setLimitVal(Number(u.limite_max_video_minutos ?? 60));
  }

  function handleToggleAdmin(u: AdminUsuario) {
    startTransition(async () => {
      const res = await setAdminFlag(u.id, !u.is_xandao);
      showMsg(res.success ? "Permissão atualizada!" : res.error ?? "Erro", res.success);
    });
  }

  function handleSavePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingUser) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const [resPlan, resCred] = await Promise.all([
        setUserPlan(editingUser.id, {
          pagante: fd.get("pagante") === "true",
          plano: String(fd.get("plano") ?? ""),
          plano_inicio: String(fd.get("plano_inicio") ?? "") || null,
          plano_fim: String(fd.get("plano_fim") ?? "") || null,
          notas: String(fd.get("notas") ?? ""),
        }),
        setUserCredits(
          editingUser.id,
          Number(fd.get("creditos_minutos") ?? creditsVal),
          Number(fd.get("limite_max_video_minutos") ?? limitVal)
        ),
      ]);

      const success = resPlan.success && resCred.success;
      showMsg(success ? "Plano e Créditos atualizados com sucesso!" : resPlan.error || resCred.error || "Erro", success);
      if (success) setEditingUser(null);
    });
  }

  return (
    <div className="admin-tab-content">
      {msg && (
        <div className={`admin-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>
      )}

      {/* Filtros */}
      <div className="admin-filters">
        <input
          className="admin-search"
          placeholder="🔍 Buscar por e-mail ou ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-filter-group">
          {(["all", "pagante", "free"] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn ${filterPlan === f ? "active" : ""}`}
              onClick={() => setFilterPlan(f)}
            >
              {f === "all" ? "Todos" : f === "pagante" ? "💎 Pagantes" : "🆓 Free"}
            </button>
          ))}
        </div>
        <span className="admin-count">{filtered.length} usuário(s)</span>
      </div>

      {/* Tabela */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Cadastro</th>
              <th>Jobs</th>
              <th>Plano</th>
              <th>Créditos / Limite</th>
              <th>Admin</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const userJobs = jobsByUser.get(u.id) ?? [];
              const doneJobs = userJobs.filter((j) => j.status === "done").length;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <span className="user-avatar">
                        {(u.email?.[0] ?? "?").toUpperCase()}
                      </span>
                      <div>
                        <div className="user-email">{u.email ?? "—"}</div>
                        <div className="user-id">{u.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td className="td-muted">{fmtDate(u.created_at)}</td>
                  <td>
                    <span className="jobs-badge">{userJobs.length}</span>
                    <span className="td-muted"> ({doneJobs} ✓)</span>
                  </td>
                  <td>
                    {u.pagante ? (
                      <span className="plan-badge pagante">💎 {u.plano ?? "Pago"}</span>
                    ) : (
                      <span className="plan-badge free">🆓 Free</span>
                    )}
                  </td>
                  <td>
                    {u.is_xandao ? (
                      <span className="plan-badge pagante" title="Isento de débitos">♾️ VIP Ilimitado</span>
                    ) : (
                      <div>
                        <span
                          className="badge"
                          style={{
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                            fontSize: "0.82rem",
                            padding: "0.15rem 0.45rem",
                            fontWeight: 700,
                          }}
                        >
                          🪙 {Number(u.creditos_minutos ?? 30).toFixed(1)} min
                        </span>
                        <span className="td-muted" style={{ fontSize: "0.75rem", display: "block", marginTop: "2px" }}>
                          Máx: {Number(u.limite_max_video_minutos ?? 60).toFixed(0)}m / vídeo
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      className={`toggle-admin ${u.is_xandao ? "on" : "off"}`}
                      onClick={() => handleToggleAdmin(u)}
                      disabled={isPending}
                      title={u.is_xandao ? "Remover acesso admin" : "Conceder acesso admin"}
                    >
                      {u.is_xandao ? "✅ Admin" : "—"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="admin-btn-sm"
                      onClick={() => handleOpenEdit(u)}
                    >
                      ✏️ Editar plano / Créditos
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de edição de plano e créditos */}
      {editingUser && (
        <div className="admin-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Editar Plano & Créditos</h3>
              <button className="modal-close" onClick={() => setEditingUser(null)}>✕</button>
            </div>
            <p className="modal-user-email">{editingUser.email}</p>
            <form onSubmit={handleSavePlan} className="modal-form">
              <label className="form-label">
                Status
                <select name="pagante" defaultValue={String(editingUser.pagante)} className="form-select">
                  <option value="false">🆓 Free</option>
                  <option value="true">💎 Pagante</option>
                </select>
              </label>
              <label className="form-label">
                Nome do plano
                <input name="plano" defaultValue={editingUser.plano ?? ""} className="form-input" placeholder="Ex: Pro, Business..." />
              </label>
              <div className="form-row">
                <label className="form-label">
                  Início do plano
                  <input type="date" name="plano_inicio" defaultValue={editingUser.plano_inicio?.slice(0, 10) ?? ""} className="form-input" />
                </label>
                <label className="form-label">
                  Vencimento
                  <input type="date" name="plano_fim" defaultValue={editingUser.plano_fim?.slice(0, 10) ?? ""} className="form-input" />
                </label>
              </div>

              {/* Seção de Gestão Manual de Créditos e Limites */}
              <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)", marginTop: "0.5rem" }}>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", color: "var(--primary)" }}>🪙 Gestão de Créditos & Limites</h4>
                <div className="form-row">
                  <label className="form-label">
                    Saldo Disponível (minutos)
                    <input
                      type="number"
                      step="0.5"
                      name="creditos_minutos"
                      value={creditsVal}
                      onChange={(e) => setCreditsVal(parseFloat(e.target.value) || 0)}
                      className="form-input"
                    />
                  </label>
                  <label className="form-label">
                    Limite Máx. por Vídeo (minutos)
                    <input
                      type="number"
                      step="1"
                      name="limite_max_video_minutos"
                      value={limitVal}
                      onChange={(e) => setLimitVal(parseFloat(e.target.value) || 0)}
                      className="form-input"
                    />
                  </label>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                  <button type="button" className="filter-btn" onClick={() => setCreditsVal((c) => c + 30)}>+30 min</button>
                  <button type="button" className="filter-btn" onClick={() => setCreditsVal((c) => c + 60)}>+60 min</button>
                  <button type="button" className="filter-btn" onClick={() => setCreditsVal((c) => c + 300)}>+300 min (Pro)</button>
                  <button type="button" className="filter-btn active" onClick={() => { setCreditsVal(99999); setLimitVal(3600); }}>💎 VIP Ilimitado</button>
                </div>
              </div>

              <label className="form-label" style={{ marginTop: "0.5rem" }}>
                Notas internas
                <textarea name="notas" defaultValue={editingUser.notas ?? ""} className="form-textarea" rows={2} placeholder="Observações sobre o usuário..." />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditingUser(null)}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={isPending}>
                  {isPending ? "Salvando..." : "💾 Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
