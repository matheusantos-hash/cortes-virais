"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import type { Job } from "@/lib/types";
import type { AdminUsuario } from "@/app/admin/page";
import { fmtDate } from "@/lib/format";
import {
  getApiCostSummary,
  type ApiCostSummary,
} from "@/app/admin/cost-actions";
import {
  DollarSign,
  Coins,
  Cpu,
  Clock,
  Film,
  Zap,
  TrendingUp,
  Server,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Lightbulb,
} from "lucide-react";

interface Props {
  jobs: Job[];
  users: AdminUsuario[];
}

type PeriodDays = 7 | 30 | 90 | 0;

export default function ApiCostsTab({ jobs, users }: Props) {
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [usdBrl, setUsdBrl] = useState<number>(5.85);
  const [higgsCost, setHiggsCost] = useState<number>(0.25);
  const [summary, setSummary] = useState<ApiCostSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Testes de conexão em tempo real
  const [testResultRailway, setTestResultRailway] = useState<{ loading: boolean; msg?: string; ok?: boolean } | null>(null);
  const [testResultClaude, setTestResultClaude] = useState<{ loading: boolean; msg?: string; ok?: boolean } | null>(null);
  const [testResultHiggs, setTestResultHiggs] = useState<{ loading: boolean; msg?: string; ok?: boolean } | null>(null);
  const [railwayTokenInput, setRailwayTokenInput] = useState<string>("");

  // Busca e filtro na tabela de jobs
  const [jobSearch, setJobSearch] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<"all" | "higgsfield" | "standard">("all");

  const loadData = () => {
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await getApiCostSummary({
          periodDays: period,
          config: {
            usdToBrlRate: usdBrl,
            higgsfieldCostPerVideoUsd: higgsCost,
          },
        });
        setSummary(res);
      } catch (err) {
        console.error("Erro ao carregar custos de API:", err);
      } finally {
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [period, usdBrl, higgsCost]);

  // Executa teste Railway
  const handleTestRailway = async () => {
    setTestResultRailway({ loading: true });
    try {
      const res = await fetch("/api/admin/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "railway", token: railwayTokenInput }),
      });
      const data = await res.json().catch(() => ({
        success: false,
        message: "Resposta inválida recebida do servidor.",
      }));
      setTestResultRailway({ loading: false, msg: data.message, ok: data.success });
    } catch (e: any) {
      setTestResultRailway({ loading: false, msg: e.message || "Erro de conexão", ok: false });
    }
  };

  // Executa teste Claude
  const handleTestClaude = async () => {
    setTestResultClaude({ loading: true });
    try {
      const res = await fetch("/api/admin/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "claude" }),
      });
      const data = await res.json().catch(() => ({
        success: false,
        message: "Resposta inválida recebida do servidor.",
      }));
      setTestResultClaude({ loading: false, msg: data.message, ok: data.success });
    } catch (e: any) {
      setTestResultClaude({ loading: false, msg: e.message || "Erro de conexão", ok: false });
    }
  };

  // Executa teste Higgsfield
  const handleTestHiggsfield = async () => {
    setTestResultHiggs({ loading: true });
    try {
      const res = await fetch("/api/admin/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "higgsfield" }),
      });
      const data = await res.json().catch(() => ({
        success: false,
        message: "Resposta inválida recebida do servidor.",
      }));
      setTestResultHiggs({ loading: false, msg: data.message, ok: data.success });
    } catch (e: any) {
      setTestResultHiggs({ loading: false, msg: e.message || "Erro ao verificar", ok: false });
    }
  };

  // Filtragem de jobs na tabela
  const filteredJobs = useMemo(() => {
    if (!summary?.jobCosts) return [];
    return summary.jobCosts.filter((j) => {
      if (jobSearch) {
        const q = jobSearch.toLowerCase();
        const matchesId = j.jobId.toLowerCase().includes(q);
        const matchesEmail = j.userEmail?.toLowerCase().includes(q);
        if (!matchesId && !matchesEmail) return false;
      }
      if (providerFilter === "higgsfield" && !j.hasBroll) return false;
      if (providerFilter === "standard" && j.hasBroll) return false;
      return true;
    });
  }, [summary?.jobCosts, jobSearch, providerFilter]);

  // Formata moeda
  const fmtUsd = (val: number) => `$ ${val.toFixed(2)}`;
  const fmtBrl = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;
  const fmtTokens = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
    return String(val);
  };

  return (
    <div className="admin-tab-content">
      {/* Barra de Controles e Configurações de Parâmetros */}
      <div className="api-costs-toolbar">
        <div className="admin-filter-group">
          {([7, 30, 90, 0] as PeriodDays[]).map((p) => (
            <button
              key={p}
              className={`filter-btn ${period === p ? "active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p === 0 ? "Todo o Histórico" : `${p} dias`}
            </button>
          ))}
        </div>

        <div className="api-costs-params">
          <div className="api-param-input" title="Taxa de conversão de Dólar para Real para cálculo de custos">
            <span className="api-param-label">Câmbio USD/BRL:</span>
            <span className="api-param-prefix">R$</span>
            <input
              type="number"
              step="0.05"
              min="1"
              value={usdBrl}
              onChange={(e) => setUsdBrl(Number(e.target.value) || 5.85)}
              className="api-param-field"
            />
          </div>

          <div className="api-param-input" title="Custo unitário estimado por geração de vídeo Kling/Minimax na Higgsfield AI">
            <span className="api-param-label">Higgsfield / vídeo:</span>
            <span className="api-param-prefix">$</span>
            <input
              type="number"
              step="0.05"
              min="0.05"
              value={higgsCost}
              onChange={(e) => setHiggsCost(Number(e.target.value) || 0.25)}
              className="api-param-field"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="filter-btn refresh-btn"
            title="Recalcular métricas de consumo"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas Principais (KPIs) */}
      <div className="resource-cards" style={{ marginBottom: 24 }}>
        <div className="resource-card" style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}>
          <div className="rc-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
            <DollarSign size={22} />
          </div>
          <div className="rc-value" style={{ color: "#a5b4fc" }}>
            {summary ? fmtUsd(summary.totalCostUsd) : "—"}
          </div>
          <div className="rc-subvalue" style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {summary ? fmtBrl(summary.totalCostBrl) : "—"}
          </div>
          <div className="rc-label">Custo Total de APIs ({summary?.period || "30 dias"})</div>
        </div>

        <div className="resource-card">
          <div className="rc-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
            <Coins size={22} />
          </div>
          <div className="rc-value">
            {summary ? fmtUsd(summary.avgCostPerJobUsd) : "—"}
          </div>
          <div className="rc-subvalue" style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {summary ? fmtBrl(summary.avgCostPerJobBrl) : "—"}
          </div>
          <div className="rc-label">Custo Médio por Job Concluído</div>
        </div>

        <div className="resource-card">
          <div className="rc-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
            <Film size={22} />
          </div>
          <div className="rc-value">
            {summary ? fmtUsd(summary.avgCostPerClipUsd) : "—"}
          </div>
          <div className="rc-subvalue" style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {summary ? fmtBrl(summary.avgCostPerClipBrl) : "—"}
          </div>
          <div className="rc-label">Custo Médio por Clipe Gerado</div>
        </div>

        <div className="resource-card" style={{ borderColor: "rgba(16, 185, 129, 0.3)" }}>
          <div className="rc-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
            <Zap size={22} />
          </div>
          <div className="rc-value" style={{ color: "#34d399" }}>
            {summary ? `+ ${fmtUsd(summary.cachingSavingsUsd)}` : "—"}
          </div>
          <div className="rc-subvalue" style={{ fontSize: "0.85rem", color: "#34d399", fontWeight: 600 }}>
            {summary ? `+ ${fmtBrl(summary.cachingSavingsUsd * usdBrl)}` : "—"}
          </div>
          <div className="rc-label">Economia com Prompt Caching (Anthropic 90% Off)</div>
        </div>
      </div>

      {/* Cards de Detalhamento por Provedor */}
      <h3 className="admin-section-title" style={{ marginTop: 24, marginBottom: 14 }}>
        <Layers size={18} style={{ color: "var(--primary)" }} />
        <span>Detalhamento de Custos por Provedor & APIs</span>
      </h3>

      <div className="api-providers-grid">
        {/* CARD 1: CLAUDE (ANTHROPIC) */}
        <div className="provider-cost-card">
          <div className="provider-card-header">
            <div className="provider-info">
              <div className="provider-badge claude-badge">Anthropic</div>
              <h4 className="provider-name">Claude Sonnet 5.5 / 5.0</h4>
            </div>
            <div className="provider-status-pill">
              {summary?.keysStatus.anthropic ? (
                <span className="status-pill active">
                  <CheckCircle2 size={12} /> Chave Ativa
                </span>
              ) : (
                <span className="status-pill warning">
                  <AlertTriangle size={12} /> Chave Ausente
                </span>
              )}
            </div>
          </div>

          <div className="provider-pricing-overview">
            <div className="provider-cost-main">
              <span className="pcm-usd">
                {summary ? fmtUsd(summary.breakdownByProvider.claude.totalCostUsd) : "—"}
              </span>
              <span className="pcm-brl">
                {summary ? fmtBrl(summary.breakdownByProvider.claude.totalCostBrl) : "—"}
              </span>
            </div>
            <div className="provider-share">
              {summary?.breakdownByProvider.claude.percentage}% do custo total
            </div>
          </div>

          <div className="provider-details-list">
            <div className="pdl-item">
              <span>Tokens de Entrada (Input):</span>
              <strong>{summary ? fmtTokens(summary.breakdownByProvider.claude.inputTokens) : "—"}</strong>
            </div>
            <div className="pdl-item">
              <span>Prompt Caching (Leituras com 90% off):</span>
              <strong style={{ color: "#34d399" }}>
                {summary ? fmtTokens(summary.breakdownByProvider.claude.cachedTokens) : "—"}
              </strong>
            </div>
            <div className="pdl-item">
              <span>Extended Thinking Tokens:</span>
              <strong>{summary ? fmtTokens(summary.breakdownByProvider.claude.thinkingTokens) : "—"}</strong>
            </div>
            <div className="pdl-item">
              <span>Tokens de Saída (JSON & Ganchos):</span>
              <strong>{summary ? fmtTokens(summary.breakdownByProvider.claude.outputTokens) : "—"}</strong>
            </div>
            <div className="pdl-item pdl-sub">
              <span>Tabela Oficial:</span>
              <span>$3.00/Mtok in · $15.00/Mtok out · $0.30/Mtok cache</span>
            </div>
          </div>

          <div className="provider-card-footer">
            <button
              onClick={handleTestClaude}
              disabled={testResultClaude?.loading}
              className="provider-test-btn"
            >
              {testResultClaude?.loading ? "Testando..." : "Testar Conexão Claude API"}
            </button>
            {testResultClaude && (
              <div className={`test-feedback ${testResultClaude.ok ? "success" : "error"}`}>
                {testResultClaude.msg}
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: HIGGSFIELD AI */}
        <div className="provider-cost-card">
          <div className="provider-card-header">
            <div className="provider-info">
              <div className="provider-badge higgsfield-badge">Higgsfield AI</div>
              <h4 className="provider-name">Geração de Vídeo / B-Rolls</h4>
            </div>
            <div className="provider-status-pill">
              {summary?.keysStatus.higgsfield ? (
                <span className="status-pill active">
                  <CheckCircle2 size={12} /> Chave Ativa
                </span>
              ) : (
                <span className="status-pill warning">
                  <AlertTriangle size={12} /> Chave Ausente
                </span>
              )}
            </div>
          </div>

          <div className="provider-pricing-overview">
            <div className="provider-cost-main">
              <span className="pcm-usd">
                {summary ? fmtUsd(summary.breakdownByProvider.higgsfield.totalCostUsd) : "—"}
              </span>
              <span className="pcm-brl">
                {summary ? fmtBrl(summary.breakdownByProvider.higgsfield.totalCostBrl) : "—"}
              </span>
            </div>
            <div className="provider-share">
              {summary?.breakdownByProvider.higgsfield.percentage}% do custo total
            </div>
          </div>

          <div className="provider-details-list">
            <div className="pdl-item">
              <span>Vídeos Gerados com IA (B-Roll):</span>
              <strong>{summary?.breakdownByProvider.higgsfield.videosGenerated || 0} vídeos</strong>
            </div>
            <div className="pdl-item">
              <span>Custo Unitário Configurado:</span>
              <strong>$ {higgsCost.toFixed(2)} por vídeo</strong>
            </div>
            <div className="pdl-item">
              <span>Modelos Utilizados:</span>
              <span>Kling v2.5 Turbo / Minimax Hailuo 2.3</span>
            </div>
            <div className="pdl-item">
              <span>Duração dos Clipes Gerados:</span>
              <span>5s a 10s cinematográficos</span>
            </div>
            <div className="pdl-item pdl-sub">
              <span>Faturamento:</span>
              <span>Créditos pré-pagos na plataforma Higgsfield</span>
            </div>
          </div>

          <div className="provider-card-footer">
            <button
              onClick={handleTestHiggsfield}
              disabled={testResultHiggs?.loading}
              className="provider-test-btn"
            >
              {testResultHiggs?.loading ? "Verificando..." : "Verificar Higgsfield API"}
            </button>
            {testResultHiggs && (
              <div className={`test-feedback ${testResultHiggs.ok ? "success" : "warning"}`}>
                {testResultHiggs.msg}
              </div>
            )}
          </div>
        </div>

        {/* CARD 3: RAILWAY (INFRAESTRUTURA) */}
        <div className="provider-cost-card">
          <div className="provider-card-header">
            <div className="provider-info">
              <div className="provider-badge railway-badge">Railway</div>
              <h4 className="provider-name">Containers & Workers</h4>
            </div>
            <div className="provider-status-pill">
              {summary?.keysStatus.railway ? (
                <span className="status-pill active">
                  <CheckCircle2 size={12} /> Token Conectado
                </span>
              ) : (
                <span className="status-pill info">
                  <Info size={12} /> Estimativa Ativa
                </span>
              )}
            </div>
          </div>

          <div className="provider-pricing-overview">
            <div className="provider-cost-main">
              <span className="pcm-usd">
                {summary ? fmtUsd(summary.breakdownByProvider.railway.totalCostUsd) : "—"}
              </span>
              <span className="pcm-brl">
                {summary ? fmtBrl(summary.breakdownByProvider.railway.totalCostBrl) : "—"}
              </span>
            </div>
            <div className="provider-share">
              {summary?.breakdownByProvider.railway.percentage}% do custo total
            </div>
          </div>

          <div className="provider-details-list">
            <div className="pdl-item">
              <span>Tempo de Execução dos Workers:</span>
              <strong>{summary?.breakdownByProvider.railway.processHours || 0} horas</strong>
            </div>
            <div className="pdl-item">
              <span>Custo Computacional Estimado:</span>
              <span>~$0.008/hora de renderização (2vCPU / 4GB)</span>
            </div>
            <div className="pdl-item">
              <span>GraphQL API Railway:</span>
              <span>backboard.railway.com/graphql/v2</span>
            </div>
            <div className="pdl-item">
              <span>Projetos & Serviços:</span>
              <span>Web Next.js + Worker Node/FFmpeg</span>
            </div>
            <div className="pdl-item pdl-sub">
              <span>Faturamento Railway:</span>
              <span>$5.00/mês base + consumo sob demanda</span>
            </div>
          </div>

          <div className="provider-card-footer">
            <div className="railway-token-box">
              <input
                type="password"
                placeholder="Account Token ou Project Token..."
                value={railwayTokenInput}
                onChange={(e) => setRailwayTokenInput(e.target.value)}
                className="railway-input"
              />
              <button
                onClick={handleTestRailway}
                disabled={testResultRailway?.loading}
                className="provider-test-btn"
              >
                {testResultRailway?.loading ? "Consultando..." : "Consultar GraphQL"}
              </button>
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4, lineHeight: 1.3 }}>
              Suporta tanto Account Token (<em>Account Settings &gt; Tokens</em>) quanto Project Token.
            </div>
            {testResultRailway && (
              <div className={`test-feedback ${testResultRailway.ok ? "success" : "error"}`}>
                {testResultRailway.msg}
              </div>
            )}
          </div>
        </div>

        {/* CARD 4: DEEPGRAM (TRANSCRIÇÃO) */}
        <div className="provider-cost-card">
          <div className="provider-card-header">
            <div className="provider-info">
              <div className="provider-badge deepgram-badge">Deepgram</div>
              <h4 className="provider-name">Speech-to-Text (Nova-3)</h4>
            </div>
            <div className="provider-status-pill">
              {summary?.keysStatus.deepgram ? (
                <span className="status-pill active">
                  <CheckCircle2 size={12} /> Chave Ativa
                </span>
              ) : (
                <span className="status-pill warning">
                  <AlertTriangle size={12} /> Chave Ausente
                </span>
              )}
            </div>
          </div>

          <div className="provider-pricing-overview">
            <div className="provider-cost-main">
              <span className="pcm-usd">
                {summary ? fmtUsd(summary.breakdownByProvider.deepgram.totalCostUsd) : "—"}
              </span>
              <span className="pcm-brl">
                {summary ? fmtBrl(summary.breakdownByProvider.deepgram.totalCostBrl) : "—"}
              </span>
            </div>
            <div className="provider-share">
              {summary?.breakdownByProvider.deepgram.percentage}% do custo total
            </div>
          </div>

          <div className="provider-details-list">
            <div className="pdl-item">
              <span>Minutos de Áudio Transcritos:</span>
              <strong>{summary?.breakdownByProvider.deepgram.audioMinutes || 0} min</strong>
            </div>
            <div className="pdl-item">
              <span>Modelo em Produção:</span>
              <span>Deepgram Nova-3 (Alta Precisão)</span>
            </div>
            <div className="pdl-item">
              <span>Recursos Ativos:</span>
              <span>Smart Format · Pontuação · Timestamps ms</span>
            </div>
            <div className="pdl-item">
              <span>Custo por Minuto:</span>
              <strong>$ 0.0043 / min (~R$ 0,025/min)</strong>
            </div>
            <div className="pdl-item pdl-sub">
              <span>Fallback:</span>
              <span>Gemini Pro Transcribe se indisponível</span>
            </div>
          </div>

          <div className="provider-card-footer">
            <div className="pdl-sub" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              ✓ Monitorado por minutagem real de áudio processada.
            </div>
          </div>
        </div>
      </div>

      {/* Explicação Técnica e Guia das APIs */}
      <div className="api-explanation-banner">
        <div className="aeb-icon">
          <Info size={24} style={{ color: "var(--primary)" }} />
        </div>
        <div className="aeb-content">
          <h4>Como funciona a coleta e consulta de dados de cada serviço?</h4>
          <div className="aeb-grid">
            <div className="aeb-col">
              <strong>1. Railway API:</strong>
              <p>
                O Railway disponibiliza uma <strong>API GraphQL oficial</strong> (<code>backboard.railway.com/graphql</code>). 
                Ao configurar a variável <code>RAILWAY_API_TOKEN</code> (obtida em <em>Railway &gt; Account Settings &gt; Tokens</em>), 
                o sistema pode consultar o status dos serviços, projetos e métricas em tempo real. Além disso, o painel calcula o custo 
                exato de horas de container baseado na duração dos jobs processados.
              </p>
            </div>
            <div className="aeb-col">
              <strong>2. Anthropic (Claude API):</strong>
              <p>
                A Anthropic possui a <strong>Admin Usage API</strong> para organizações. Adicionalmente, nosso worker rastreia 
                <strong> 100% dos tokens reais</strong> em cada chamada (input, output, extended thinking e leituras com Prompt Caching), 
                aplicando a tabela oficial (\$3/MTok input, \$15/MTok output, \$0.30/MTok cache), garantindo precisão matemática até no nível de centavos.
              </p>
            </div>
            <div className="aeb-col">
              <strong>3. Higgsfield AI:</strong>
              <p>
                A Higgsfield API opera estritamente como um motor de inferência de vídeo generativo e <em>não possui endpoint público REST de consulta de saldo/fatura</em>. 
                Por isso, nosso monitor contabiliza diretamente todas as chamadas de geração disparadas pelo pipeline, calculando o investimento com base no custo por vídeo gerado.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Consumo por Usuário & Projeção */}
      <div className="admin-grid-two" style={{ marginTop: 24 }}>
        {/* Top Usuários por Consumo */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h4 className="admin-card-title">
              <Coins size={16} style={{ color: "var(--primary)" }} />
              Top Usuários por Custo de API
            </h4>
            <span className="admin-card-badge">{summary?.topUsersByCost.length || 0} usuários</span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Jobs</th>
                  <th>Custo (USD)</th>
                  <th>Custo (BRL)</th>
                </tr>
              </thead>
              <tbody>
                {summary?.topUsersByCost.map((u) => (
                  <tr key={u.userId}>
                    <td style={{ fontWeight: 600 }}>{u.email}</td>
                    <td>{u.jobCount}</td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{fmtUsd(u.totalCostUsd)}</td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--primary)" }}>
                      {fmtBrl(u.totalCostBrl)}
                    </td>
                  </tr>
                ))}
                {(!summary?.topUsersByCost || summary.topUsersByCost.length === 0) && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      Nenhum consumo registrado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Simulador de Escala e Custos Futuros */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h4 className="admin-card-title">
              <TrendingUp size={16} style={{ color: "#34d399" }} />
              Projeção e Simulação de Escala Mensal
            </h4>
            <span className="admin-card-badge">Planejamento</span>
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
            Baseado no seu custo médio real de <strong>{summary ? fmtUsd(summary.avgCostPerJobUsd) : "$0.00"}</strong> por vídeo processado:
          </p>

          <div className="scale-projection-list">
            {[100, 500, 1000, 5000].map((volume) => {
              const costUsd = (summary?.avgCostPerJobUsd || 0.05) * volume;
              const costBrl = costUsd * usdBrl;
              return (
                <div key={volume} className="projection-item">
                  <div className="proj-vol">
                    <strong>{volume}</strong> vídeos/mês
                  </div>
                  <div className="proj-bar-wrap">
                    <div
                      className="proj-bar"
                      style={{ width: `${Math.min(100, (volume / 5000) * 100)}%` }}
                    />
                  </div>
                  <div className="proj-cost">
                    <span className="proj-usd">{fmtUsd(costUsd)}</span>
                    <span className="proj-brl">{fmtBrl(costBrl)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, fontSize: "0.8rem", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: 12, borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <Lightbulb size={16} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>Dica de Precificação:</strong> Se o seu plano PRO custa R$ 59,90/mês e dá direito a 15 vídeos, seu custo de API será de ~R$ 4,50, gerando uma margem bruta superior a <strong>90%</strong>.
            </span>
          </div>
        </div>
      </div>

      {/* Tabela Granular de Jobs e Custos */}
      <div className="admin-card" style={{ marginTop: 24 }}>
        <div className="admin-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h4 className="admin-card-title">
              <Film size={16} style={{ color: "var(--primary)" }} />
              Custos Granulares por Job ({filteredJobs.length} de {summary?.jobCosts.length || 0})
            </h4>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="admin-search-wrap" style={{ width: 220 }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Buscar por ID ou e-mail..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
              />
            </div>

            <div className="admin-filter-group">
              <button
                className={`filter-btn ${providerFilter === "all" ? "active" : ""}`}
                onClick={() => setProviderFilter("all")}
              >
                Todos
              </button>
              <button
                className={`filter-btn ${providerFilter === "higgsfield" ? "active" : ""}`}
                onClick={() => setProviderFilter("higgsfield")}
              >
                Com Higgsfield IA
              </button>
              <button
                className={`filter-btn ${providerFilter === "standard" ? "active" : ""}`}
                onClick={() => setProviderFilter("standard")}
              >
                Padrão
              </button>
            </div>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table compact">
            <thead>
              <tr>
                <th>Job / Usuário</th>
                <th>Data</th>
                <th>Status</th>
                <th>Clipes</th>
                <th>Claude (USD)</th>
                <th>Higgsfield (USD)</th>
                <th>Deepgram (USD)</th>
                <th>Railway (USD)</th>
                <th>Total (USD)</th>
                <th>Total (BRL)</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.slice(0, 50).map((j) => (
                <tr key={j.jobId}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{j.userEmail}</div>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {j.jobId.slice(0, 8)}...
                    </div>
                  </td>
                  <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {fmtDate(j.createdAt)}
                  </td>
                  <td>
                    <span className={`status-badge ${j.status}`}>
                      {j.status === "done" ? "Concluído" : j.status === "failed" ? "Falhou" : j.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <strong>{j.clipCount}</strong>
                    {j.hasBroll && (
                      <span className="broll-tag" title="Usou Higgsfield AI para B-roll">
                        +IA
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}>
                    {fmtUsd(j.costsUsd.claude)}
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}>
                    {j.costsUsd.higgsfield > 0 ? (
                      <span style={{ color: "#ec4899", fontWeight: 600 }}>
                        {fmtUsd(j.costsUsd.higgsfield)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}>
                    {fmtUsd(j.costsUsd.deepgram)}
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}>
                    {fmtUsd(j.costsUsd.railway)}
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", fontWeight: 700 }}>
                    {fmtUsd(j.costsUsd.total)}
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)" }}>
                    {fmtBrl(j.costBrl)}
                  </td>
                </tr>
              ))}
              {filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    Nenhum job encontrado para os critérios selecionados.
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
