"use client";

import { useState } from "react";
import type { AdminUsuario, AdminStats } from "@/app/admin/page";
import type { Job } from "@/lib/types";
import UsersTab from "./UsersTab";
import ResourcesTab from "./ResourcesTab";
import PerformanceTab from "./PerformanceTab";

interface Props {
  users: AdminUsuario[];
  jobs: Job[];
  stats: AdminStats;
}

type TabKey = "users" | "resources" | "performance";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "users", label: "Usuários", icon: "👥" },
  { key: "resources", label: "Recursos", icon: "🖥️" },
  { key: "performance", label: "Desempenho", icon: "📊" },
];

export default function AdminDashboard({ users, jobs, stats }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("users");

  return (
    <div className="admin-shell">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-title">
          <span className="admin-header-icon">⚙️</span>
          <div>
            <h1 className="admin-title">Painel Administrativo</h1>
            <p className="admin-subtitle">Visão interna do sistema · acesso restrito</p>
          </div>
        </div>

        {/* Stat cards rápidos */}
        <div className="admin-quick-stats">
          <div className="qs-card">
            <span className="qs-value">{stats.totalUsers}</span>
            <span className="qs-label">Usuários</span>
          </div>
          <div className="qs-card qs-accent">
            <span className="qs-value">{stats.pagantes}</span>
            <span className="qs-label">Pagantes</span>
          </div>
          <div className="qs-card">
            <span className="qs-value">{stats.totalJobs}</span>
            <span className="qs-label">Jobs</span>
          </div>
          <div className="qs-card qs-success">
            <span className="qs-value">{stats.done}</span>
            <span className="qs-label">Concluídos</span>
          </div>
          <div className="qs-card qs-danger">
            <span className="qs-value">{stats.failed}</span>
            <span className="qs-label">Falhas</span>
          </div>
          <div className="qs-card qs-warning">
            <span className="qs-value">{stats.running}</span>
            <span className="qs-label">Em fila/andamento</span>
          </div>
          <div className="qs-card">
            <span className="qs-value">{stats.totalClips}</span>
            <span className="qs-label">Clipes gerados</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="admin-tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="admin-content">
        {activeTab === "users" && <UsersTab users={users} jobs={jobs} />}
        {activeTab === "resources" && <ResourcesTab jobs={jobs} />}
        {activeTab === "performance" && <PerformanceTab jobs={jobs} users={users} />}
      </div>
    </div>
  );
}
