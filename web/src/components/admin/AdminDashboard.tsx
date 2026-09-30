"use client";

import { useState } from "react";
import type { AdminUsuario, AdminStats } from "@/app/admin/page";
import type { Job } from "@/lib/types";
import UsersTab from "./UsersTab";
import ResourcesTab from "./ResourcesTab";
import PerformanceTab from "./PerformanceTab";
import { UsersIcon, CpuIcon, BarChartIcon, ShieldIcon } from "@/components/Icons";

interface Props {
  users: AdminUsuario[];
  jobs: Job[];
  stats: AdminStats;
}

type TabKey = "users" | "resources" | "performance";

export default function AdminDashboard({ users, jobs, stats }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("users");

  return (
    <div className="admin-shell">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-title">
          <div className="brand-icon-wrap" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <ShieldIcon size={24} />
          </div>
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
        <button
          className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <UsersIcon size={18} />
          <span>Usuários</span>
        </button>
        <button
          className={`admin-tab ${activeTab === "resources" ? "active" : ""}`}
          onClick={() => setActiveTab("resources")}
        >
          <CpuIcon size={18} />
          <span>Recursos</span>
        </button>
        <button
          className={`admin-tab ${activeTab === "performance" ? "active" : ""}`}
          onClick={() => setActiveTab("performance")}
        >
          <BarChartIcon size={18} />
          <span>Desempenho</span>
        </button>
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
