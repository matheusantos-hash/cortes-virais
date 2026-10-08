"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminUsuario } from "@/app/admin/page";
import type { Clip, Job } from "@/lib/types";
import { fmtDate, fmtClock } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { adminDeleteClip, adminDeleteClipsBatch } from "@/app/admin/actions";
import {
  FilmIcon,
  TrashIcon,
  PlayIcon,
  SearchIcon,
  TrendingUpIcon,
  ClockIcon,
  XIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CrownIcon,
  ZapIcon,
} from "@/components/Icons";
import { HardDrive } from "lucide-react";

interface Props {
  clips: Clip[];
  users: AdminUsuario[];
  jobs: Job[];
}

export default function ClipsTab({ clips, users, jobs }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Clip[]>(clips);

  useEffect(() => {
    setItems(clips);
  }, [clips]);

  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterScore, setFilterScore] = useState<"all" | "high" | "med" | "low">("all");
  const [sortBy, setSortBy] = useState<"recent" | "score-desc" | "score-asc" | "dur-desc">("recent");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal de preview
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Modal / Confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    type: "single" | "batch";
    targetId?: string;
    targetTitle?: string;
    count?: number;
  }>({ open: false, type: "single" });

  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const supabase = createClient();

  // Mapeamentos rápidos
  const usersMap = useMemo(() => {
    const map = new Map<string, AdminUsuario>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const jobsMap = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach((j) => map.set(j.id, j));
    return map;
  }, [jobs]);

  function showMsg(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  }

  // Filtragem e ordenação
  const filtered = useMemo(() => {
    return items
      .filter((c) => {
        // Usuário
        if (filterUser !== "all" && c.user_id !== filterUser) return false;

        // Score viral
        if (filterScore === "high" && (c.score ?? 0) < 80) return false;
        if (filterScore === "med" && ((c.score ?? 0) < 50 || (c.score ?? 0) >= 80)) return false;
        if (filterScore === "low" && (c.score ?? 0) >= 50) return false;

        // Busca textual
        if (search.trim()) {
          const q = search.toLowerCase();
          const user = c.user_id ? usersMap.get(c.user_id) : undefined;
          const matchTitle = (c.title || "").toLowerCase().includes(q);
          const matchHook = (c.hook || "").toLowerCase().includes(q);
          const matchId = c.id.toLowerCase().includes(q);
          const matchEmail = (user?.email || "").toLowerCase().includes(q);
          const matchJob = (c.job_id || "").toLowerCase().includes(q);
          return matchTitle || matchHook || matchId || matchEmail || matchJob;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "score-desc") return (b.score ?? 0) - (a.score ?? 0);
        if (sortBy === "score-asc") return (a.score ?? 0) - (b.score ?? 0);
        if (sortBy === "dur-desc") {
          const durA = (a.end_seconds ?? 0) - (a.start_seconds ?? 0);
          const durB = (b.end_seconds ?? 0) - (b.start_seconds ?? 0);
          return durB - durA;
        }
        // recent
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [items, filterUser, filterScore, search, sortBy, usersMap]);

  // Estatísticas do conjunto filtrado
  const stats = useMemo(() => {
    const total = filtered.length;
    const avgScore = total > 0 ? Math.round(filtered.reduce((s, c) => s + (c.score ?? 0), 0) / total) : 0;
    const totalDuration = filtered.reduce((s, c) => s + Math.max(0, (c.end_seconds ?? 0) - (c.start_seconds ?? 0)), 0);
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
    const estStorageMB = total * 15; // Estimativa média ~15MB por vídeo cortado

    return { total, avgScore, avgDuration, estStorageMB };
  }, [filtered]);

  // Multi-seleção
  const isAllSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Reproduzir vídeo / preview
  async function handleOpenPreview(clip: Clip) {
    setPreviewClip(clip);
    setPreviewUrl(null);
    if (!clip.file_path) return;

    setLoadingPreview(true);
    try {
      const { data, error } = await supabase.storage.from("clips").createSignedUrl(clip.file_path, 3600);
      if (error || !data?.signedUrl) {
        showMsg("Não foi possível gerar link do vídeo (arquivo pode ter sido removido do storage).", false);
      } else {
        setPreviewUrl(data.signedUrl);
      }
    } catch {
      showMsg("Erro ao abrir vídeo.", false);
    } finally {
      setLoadingPreview(false);
    }
  }

  // Ações de exclusão
  function handleExecuteDelete() {
    if (confirmDelete.type === "single" && confirmDelete.targetId) {
      const id = confirmDelete.targetId;
      startTransition(async () => {
        try {
          const res = await adminDeleteClip(id);
          if (res.success) {
            setConfirmDelete({ open: false, type: "single" });
            showMsg("Clipe excluído com sucesso!", true);
            setItems((prev) => prev.filter((c) => c.id !== id));
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            router.refresh();
          } else {
            showMsg(res.error || "Erro ao excluir clipe.", false);
            alert(`Não foi possível excluir o clipe: ${res.error || "Erro desconhecido"}`);
          }
        } catch (err: any) {
          showMsg(err?.message || "Falha ao excluir clipe.", false);
          alert(`Erro inesperado ao excluir: ${err?.message || "Tente novamente."}`);
        }
      });
    } else if (confirmDelete.type === "batch") {
      const ids = Array.from(selectedIds);
      startTransition(async () => {
        try {
          const res = await adminDeleteClipsBatch(ids);
          if (res.success) {
            setConfirmDelete({ open: false, type: "batch" });
            showMsg(`${res.count} clipe(s) excluído(s) com sucesso!`, true);
            setItems((prev) => prev.filter((c) => !ids.includes(c.id)));
            setSelectedIds(new Set());
            router.refresh();
          } else {
            showMsg(res.error || "Erro ao excluir clipes em lote.", false);
            alert(`Não foi possível excluir os clipes: ${res.error || "Erro desconhecido"}`);
          }
        } catch (err: any) {
          showMsg(err?.message || "Falha ao excluir em lote.", false);
          alert(`Erro inesperado ao excluir lote: ${err?.message || "Tente novamente."}`);
        }
      });
    }
  }

  return (
    <div className="admin-tab-content">
      {/* Toast flutuante visível em qualquer altura de rolagem (scroll) */}
      {msg && (
        <div
          className={`admin-msg ${msg.ok ? "ok" : "err"}`}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
            padding: "12px 20px",
            borderRadius: "10px",
            maxWidth: "420px",
          }}
        >
          {msg.ok ? <CheckCircleIcon size={18} /> : <AlertCircleIcon size={18} />}
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{msg.text}</span>
        </div>
      )}

      {/* Cartões rápidos de métricas dos Clipes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6 }}>
            <FilmIcon size={16} style={{ color: "var(--primary)" }} />
            Total de Clipes
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>{stats.total}</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6 }}>
            <TrendingUpIcon size={16} style={{ color: "#10B981" }} />
            Score Viral Médio
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10B981" }}>{stats.avgScore} <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>/ 100</span></div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6 }}>
            <ClockIcon size={16} style={{ color: "var(--primary)" }} />
            Duração Média
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>{stats.avgDuration}s</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6 }}>
            <HardDrive size={16} style={{ color: "var(--text-muted)" }} />
            Armazenamento Est.
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
            {stats.estStorageMB >= 1024 ? `${(stats.estStorageMB / 1024).toFixed(1)} GB` : `${stats.estStorageMB} MB`}
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="admin-filters" style={{ flexWrap: "wrap", gap: 12 }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <SearchIcon size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            className="admin-search"
            style={{ width: "100%", paddingLeft: 36 }}
            placeholder="Buscar por título, hook, id, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filtro por usuário */}
        <select
          className="admin-select"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="all">Todos os usuários</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email || u.id.slice(0, 10)}
            </option>
          ))}
        </select>

        {/* Filtro por score viral */}
        <div className="admin-filter-group">
          {(
            [
              { id: "all", label: "Todos", icon: null },
              { id: "high", label: "80+ Alto", icon: <TrendingUpIcon size={12} /> },
              { id: "med", label: "50-79 Médio", icon: <ZapIcon size={12} /> },
              { id: "low", label: "<50 Baixo", icon: null },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`filter-btn ${filterScore === item.id ? "active" : ""}`}
              onClick={() => setFilterScore(item.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Ordenação */}
        <select
          className="admin-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{ minWidth: 150 }}
        >
          <option value="recent">Mais recentes</option>
          <option value="score-desc">Maior score viral</option>
          <option value="score-asc">Menor score viral</option>
          <option value="dur-desc">Maior duração</option>
        </select>

        <span className="admin-count">{filtered.length} clipe(s)</span>
      </div>

      {/* Barra de ações em lote */}
      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            padding: "10px 16px",
            borderRadius: 10,
            marginBottom: 14,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--danger)" }}>
              {selectedIds.size} clipe(s) selecionado(s)
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
            >
              Desmarcar todos
            </button>
          </div>

          <button
            className="admin-btn-sm danger"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", fontWeight: 700 }}
            disabled={isPending}
            onClick={() =>
              setConfirmDelete({
                open: true,
                type: "batch",
                count: selectedIds.size,
              })
            }
          >
            <TrashIcon size={14} />
            Excluir {selectedIds.size} selecionado(s)
          </button>
        </div>
      )}

      {/* Tabela de Clipes */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  aria-label="Selecionar todos os clipes"
                  style={{ cursor: "pointer" }}
                />
              </th>
              <th style={{ width: 100 }}>Vídeo</th>
              <th>Título & Hook</th>
              <th>Usuário</th>
              <th>Score Viral</th>
              <th>Duração</th>
              <th>Data</th>
              <th style={{ textAlign: "right", width: 120 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)" }}>
                  Nenhum clipe encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filtered.map((clip) => {
                const isSelected = selectedIds.has(clip.id);
                const user = clip.user_id ? usersMap.get(clip.user_id) : undefined;
                const duration = Math.max(0, Math.round((clip.end_seconds ?? 0) - (clip.start_seconds ?? 0)));
                const score = clip.score ?? 0;

                // Estilo da pílula de score
                const scoreColor = score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#64748B";
                const scoreBg = score >= 80 ? "rgba(16, 185, 129, 0.12)" : score >= 50 ? "rgba(245, 158, 11, 0.12)" : "rgba(100, 116, 139, 0.1)";

                return (
                  <tr key={clip.id} style={{ background: isSelected ? "rgba(79, 70, 229, 0.04)" : undefined }}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(clip.id)}
                        aria-label={`Selecionar clipe ${clip.title}`}
                        style={{ cursor: "pointer" }}
                      />
                    </td>

                    {/* Miniatura / Play */}
                    <td>
                      <div
                        onClick={() => handleOpenPreview(clip)}
                        style={{
                          width: 80,
                          height: 48,
                          borderRadius: 6,
                          background: "#0F172A",
                          position: "relative",
                          cursor: "pointer",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid var(--card-border)",
                        }}
                        title="Clique para assistir"
                      >
                        {clip.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={clip.thumbnail_url}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : null}
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.15s",
                          }}
                        >
                          <PlayIcon size={16} style={{ color: "#FFF", fill: "#FFF" }} />
                        </div>
                      </div>
                    </td>

                    {/* Título & Hook */}
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.88rem", marginBottom: 2 }}>
                        {clip.title || "Sem título"}
                      </div>
                      {clip.hook && (
                        <div
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                            maxWidth: 340,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={clip.hook}
                        >
                          &ldquo;{clip.hook}&rdquo;
                        </div>
                      )}
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>
                        ID: {clip.id.slice(0, 8)}...
                      </div>
                    </td>

                    {/* Usuário */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text)" }}>
                        {user?.email || "Usuário não encontrado"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {user?.pagante ? (
                          <span style={{ color: "var(--primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <CrownIcon size={11} /> Pagante
                          </span>
                        ) : (
                          "Free"
                        )}
                      </div>
                    </td>

                    {/* Score Viral */}
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: scoreColor,
                          background: scoreBg,
                        }}
                      >
                        <TrendingUpIcon size={12} />
                        {score} pts
                      </span>
                    </td>

                    {/* Duração & Trecho */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{duration}s</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {fmtClock(clip.start_seconds)} - {fmtClock(clip.end_seconds)}
                      </div>
                    </td>

                    {/* Data */}
                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {clip.created_at ? fmtDate(clip.created_at) : "—"}
                    </td>

                    {/* Ações */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <button
                          className="admin-btn-sm"
                          onClick={() => handleOpenPreview(clip)}
                          title="Assistir prévia"
                        >
                          <PlayIcon size={13} />
                        </button>
                        <button
                          className="admin-btn-sm danger"
                          disabled={isPending}
                          onClick={() =>
                            setConfirmDelete({
                              open: true,
                              type: "single",
                              targetId: clip.id,
                              targetTitle: clip.title || "este clipe",
                            })
                          }
                          title="Excluir clipe da biblioteca"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Preview de Vídeo */}
      {previewClip && (
        <div className="admin-modal-overlay" onClick={() => setPreviewClip(null)}>
          <div
            className="admin-modal"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                  {previewClip.title || "Prévia do Clipe"}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {previewClip.hook || "Sem gancho registrado"}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setPreviewClip(null)}
                style={{ cursor: "pointer", background: "none", border: "none" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              {loadingPreview ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                  Carregando vídeo...
                </div>
              ) : previewUrl ? (
                <div style={{ borderRadius: 12, overflow: "hidden", background: "#000" }}>
                  <video
                    src={previewUrl}
                    controls
                    autoPlay
                    playsInline
                    style={{ width: "100%", maxHeight: "65vh", display: "block" }}
                  />
                </div>
              ) : (
                <div style={{ padding: 30, textAlign: "center", color: "var(--danger)", fontSize: "0.88rem" }}>
                  Arquivo de vídeo não encontrado no bucket de armazenamento.
                </div>
              )}
            </div>

            <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Score: <strong>{previewClip.score ?? 0} pts</strong> · Duração:{" "}
                <strong>{Math.round((previewClip.end_seconds ?? 0) - (previewClip.start_seconds ?? 0))}s</strong>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="admin-btn-sm danger"
                  onClick={() => {
                    setConfirmDelete({
                      open: true,
                      type: "single",
                      targetId: previewClip.id,
                      targetTitle: previewClip.title || "este clipe",
                    });
                    setPreviewClip(null);
                  }}
                >
                  <TrashIcon size={14} style={{ marginRight: 4 }} />
                  Excluir clipe
                </button>
                <button className="admin-btn-sm" onClick={() => setPreviewClip(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {confirmDelete.open && (
        <div className="admin-modal-overlay" onClick={() => setConfirmDelete({ open: false, type: "single" })}>
          <div
            className="admin-modal"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0, color: "var(--danger)", display: "flex", alignItems: "center", gap: 8 }}>
                <TrashIcon size={20} />
                Confirmar Exclusão
              </h3>
              <button
                className="modal-close"
                onClick={() => setConfirmDelete({ open: false, type: "single" })}
                style={{ cursor: "pointer", background: "none", border: "none" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div style={{ margin: "16px 0 24px", fontSize: "0.88rem", color: "var(--text)", lineHeight: 1.5 }}>
              {confirmDelete.type === "single" ? (
                <>
                  Tem certeza que deseja apagar permanentemente o clipe{" "}
                  <strong>&ldquo;{confirmDelete.targetTitle}&rdquo;</strong>?
                  <br />
                  <br />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    Esta ação removerá o arquivo de vídeo do armazenamento (Storage) e os dados do banco de dados para sempre.
                  </span>
                </>
              ) : (
                <>
                  Tem certeza que deseja apagar permanentemente os{" "}
                  <strong>{confirmDelete.count} clipe(s) selecionados</strong>?
                  <br />
                  <br />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    Esta ação limpará todos os arquivos correspondentes do Storage e registros do banco em lote.
                  </span>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                className="admin-btn-sm"
                onClick={() => setConfirmDelete({ open: false, type: "single" })}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                className="admin-btn-sm danger"
                onClick={handleExecuteDelete}
                disabled={isPending}
                style={{ padding: "6px 16px", fontWeight: 700 }}
              >
                {isPending ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
