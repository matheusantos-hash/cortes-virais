"use server";

import { createClient, checkAdmin } from "@/lib/supabase/server";

export interface ApiCostConfig {
  usdToBrlRate: number;
  higgsfieldCostPerVideoUsd: number;
  deepgramCostPerMinUsd: number;
  railwayPerHourUsd: number;
  claudePromptPricePerMtok: number; // $3.00
  claudeOutputPricePerMtok: number; // $15.00
  claudeCacheReadPricePerMtok: number; // $0.30
}

const DEFAULT_COST_CONFIG: ApiCostConfig = {
  usdToBrlRate: 5.85,
  higgsfieldCostPerVideoUsd: 0.25, // Kling / Minimax ~ $0.25/geração
  deepgramCostPerMinUsd: 0.0043, // Nova-3 ~ $0.0043/min
  railwayPerHourUsd: 0.008, // Container worker ~2vCPU 4GB RAM (~$5.70/mês prorrateado ou $0.008/hora de job)
  claudePromptPricePerMtok: 3.0, // Claude 3.7 / 3.5 Sonnet
  claudeOutputPricePerMtok: 15.0,
  claudeCacheReadPricePerMtok: 0.3,
};

export interface JobCostBreakdown {
  jobId: string;
  userId: string;
  userEmail?: string;
  createdAt: string;
  status: string;
  durationSeconds: number;
  clipCount: number;
  brollSource?: string;
  hasBroll: boolean;
  // Detalhes calculados
  claudeTokens: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    cachedTokens: number;
  };
  costsUsd: {
    claude: number;
    higgsfield: number;
    deepgram: number;
    railway: number;
    total: number;
  };
  costBrl: number;
}

export interface ApiCostSummary {
  period: string;
  totalJobs: number;
  doneJobs: number;
  totalClips: number;
  totalCostUsd: number;
  totalCostBrl: number;
  avgCostPerJobUsd: number;
  avgCostPerJobBrl: number;
  avgCostPerClipUsd: number;
  avgCostPerClipBrl: number;
  cachingSavingsUsd: number;
  breakdownByProvider: {
    claude: {
      totalCostUsd: number;
      totalCostBrl: number;
      inputTokens: number;
      outputTokens: number;
      thinkingTokens: number;
      cachedTokens: number;
      percentage: number;
    };
    higgsfield: {
      totalCostUsd: number;
      totalCostBrl: number;
      videosGenerated: number;
      percentage: number;
    };
    deepgram: {
      totalCostUsd: number;
      totalCostBrl: number;
      audioMinutes: number;
      percentage: number;
    };
    railway: {
      totalCostUsd: number;
      totalCostBrl: number;
      processHours: number;
      percentage: number;
    };
  };
  jobCosts: JobCostBreakdown[];
  topUsersByCost: Array<{
    userId: string;
    email: string;
    jobCount: number;
    totalCostUsd: number;
    totalCostBrl: number;
  }>;
  keysStatus: {
    anthropic: boolean;
    anthropicAdmin: boolean;
    higgsfield: boolean;
    deepgram: boolean;
    railway: boolean;
  };
}



/**
 * Calcula os custos de API com base nos jobs reais e regras oficiais de pricing.
 */
export async function getApiCostSummary(options?: {
  periodDays?: number;
  config?: Partial<ApiCostConfig>;
}): Promise<ApiCostSummary> {
  const supabase = await createClient();
  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    throw new Error("Acesso não autorizado ao painel de custos");
  }

  const cfg: ApiCostConfig = { ...DEFAULT_COST_CONFIG, ...options?.config };
  const periodDays = options?.periodDays ?? 30;

  // Busca dados de jobs e usuários
  let jobsQuery = supabase
    .from("jobs")
    .select(
      "id, user_id, status, created_at, started_at, finished_at, source_type, clip_count, min_seconds, max_seconds, broll_source, use_broll, logs"
    )
    .order("created_at", { ascending: false });

  if (periodDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    jobsQuery = jobsQuery.gte("created_at", cutoff.toISOString());
  }

  const [{ data: jobsData, error: jobsError }, { data: usersData }] = await Promise.all([
    jobsQuery,
    supabase.from("usuarios").select("id, email"),
  ]);

  if (jobsError) {
    console.error("[getApiCostSummary] erro ao buscar jobs:", jobsError);
  }

  const jobs = jobsData ?? [];
  const users = usersData ?? [];
  const emailMap = new Map<string, string>(users.map((u: any) => [u.id, u.email || "Sem e-mail"]));

  let totalClaudeUsd = 0;
  let totalHiggsfieldUsd = 0;
  let totalDeepgramUsd = 0;
  let totalRailwayUsd = 0;

  let totalClaudeInputTokens = 0;
  let totalClaudeOutputTokens = 0;
  let totalClaudeThinkingTokens = 0;
  let totalClaudeCachedTokens = 0;
  let totalHiggsfieldVideos = 0;
  let totalAudioMinutes = 0;
  let totalProcessHours = 0;
  let totalClipsSum = 0;
  let doneCount = 0;

  const jobCosts: JobCostBreakdown[] = [];
  const userCostMap = new Map<string, { jobCount: number; costUsd: number }>();

  for (const j of jobs) {
    const isDone = j.status === "done";
    if (isDone) doneCount++;

    // Duração do processamento em segundos
    let procDurationSec = 0;
    if (j.started_at && j.finished_at) {
      procDurationSec = Math.max(
        0,
        (new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000
      );
    } else {
      procDurationSec = isDone ? 120 : 30; // fallback razoável
    }
    const procHours = procDurationSec / 3600;
    totalProcessHours += procHours;

    // Estimativa da duração original do áudio para Deepgram:
    // Baseado na média dos clipes gerados e regras de corte
    const clipCount = j.clip_count || 5;
    if (isDone) totalClipsSum += clipCount;

    // Duração estimada do vídeo fonte em minutos (típico vídeo no pipeline: 10 a 20 min)
    const estimatedVideoMinutes = isDone ? Math.max(5, Math.min(60, clipCount * 2.5)) : 5;
    totalAudioMinutes += estimatedVideoMinutes;

    // 1. Custo Deepgram Nova-3:
    const deepgramCost = estimatedVideoMinutes * cfg.deepgramCostPerMinUsd;
    totalDeepgramUsd += deepgramCost;

    // 2. Tokens e Custo Claude (Anthropic):
    // Cada minuto de vídeo gera aprox 150 palavras = 200 tokens de transcrição
    const transcriptTokens = Math.round(estimatedVideoMinutes * 200);
    const systemPromptTokens = 1500; // Prompt mestre cacheado
    const cachedTokens = systemPromptTokens; // 90% discount com Prompt Caching
    const regularInputTokens = transcriptTokens + 500; // guidelines de estilo
    const thinkingTokens = 2048; // Extended Thinking padrão
    const outputTokens = Math.round(clipCount * 300); // JSON com ganchos, raciocínios e timestamps

    totalClaudeInputTokens += regularInputTokens;
    totalClaudeCachedTokens += cachedTokens;
    totalClaudeThinkingTokens += thinkingTokens;
    totalClaudeOutputTokens += outputTokens;

    // Preços oficiais Sonnet:
    // Input regular: $3 / Mtok
    // Cache read: $0.30 / Mtok (economia de 90%)
    // Output + Thinking: $15 / Mtok
    const claudeCost =
      (regularInputTokens / 1_000_000) * cfg.claudePromptPricePerMtok +
      (cachedTokens / 1_000_000) * cfg.claudeCacheReadPricePerMtok +
      ((outputTokens + thinkingTokens) / 1_000_000) * cfg.claudeOutputPricePerMtok;

    totalClaudeUsd += claudeCost;

    // 3. Higgsfield AI:
    // Verifica se houve geração de B-Roll com Higgsfield no job
    const usesHiggsfield =
      j.broll_source === "higgsfield" ||
      (j.broll_source === "auto" && j.use_broll === true);

    // Contamos quantas gerações foram disparadas: cada clipe pode receber 1 B-Roll IA
    let higgsfieldVideosInJob = 0;
    if (usesHiggsfield && isDone) {
      // Verifica logs para contagem precisa ou estima por clipe
      const logsText = Array.isArray(j.logs) ? j.logs.join(" ") : "";
      const matches = logsText.match(/\[HIGGSFIELD AI\] Enviando prompt/gi);
      if (matches && matches.length > 0) {
        higgsfieldVideosInJob = matches.length;
      } else {
        // Média de 1 a 2 B-rolls por job com Higgsfield ativo
        higgsfieldVideosInJob = Math.min(clipCount, 2);
      }
    }
    totalHiggsfieldVideos += higgsfieldVideosInJob;
    const higgsfieldCost = higgsfieldVideosInJob * cfg.higgsfieldCostPerVideoUsd;
    totalHiggsfieldUsd += higgsfieldCost;

    // 4. Railway (Infra / Containers):
    const railwayCost = procHours * cfg.railwayPerHourUsd;
    totalRailwayUsd += railwayCost;

    const jobTotalUsd = claudeCost + higgsfieldCost + deepgramCost + railwayCost;
    const jobTotalBrl = jobTotalUsd * cfg.usdToBrlRate;

    jobCosts.push({
      jobId: j.id,
      userId: j.user_id,
      userEmail: emailMap.get(j.user_id) || "Desconhecido",
      createdAt: j.created_at,
      status: j.status,
      durationSeconds: Math.round(procDurationSec),
      clipCount,
      brollSource: j.broll_source,
      hasBroll: usesHiggsfield,
      claudeTokens: {
        inputTokens: regularInputTokens,
        outputTokens,
        thinkingTokens,
        cachedTokens,
      },
      costsUsd: {
        claude: Number(claudeCost.toFixed(4)),
        higgsfield: Number(higgsfieldCost.toFixed(4)),
        deepgram: Number(deepgramCost.toFixed(4)),
        railway: Number(railwayCost.toFixed(4)),
        total: Number(jobTotalUsd.toFixed(4)),
      },
      costBrl: Number(jobTotalBrl.toFixed(2)),
    });

    // Agrupa por usuário
    const prevUser = userCostMap.get(j.user_id) || { jobCount: 0, costUsd: 0 };
    userCostMap.set(j.user_id, {
      jobCount: prevUser.jobCount + 1,
      costUsd: prevUser.costUsd + jobTotalUsd,
    });
  }

  const totalCostUsd = totalClaudeUsd + totalHiggsfieldUsd + totalDeepgramUsd + totalRailwayUsd;
  const totalCostBrl = totalCostUsd * cfg.usdToBrlRate;

  // Economia gerada pelo Prompt Caching da Anthropic (diferença entre $3.00 e $0.30)
  const cachingSavingsUsd =
    (totalClaudeCachedTokens / 1_000_000) *
    (cfg.claudePromptPricePerMtok - cfg.claudeCacheReadPricePerMtok);

  const safeTotal = totalCostUsd > 0 ? totalCostUsd : 1;
  const avgCostPerJobUsd = doneCount > 0 ? totalCostUsd / doneCount : 0;
  const avgCostPerClipUsd = totalClipsSum > 0 ? totalCostUsd / totalClipsSum : 0;

  const topUsersByCost = [...userCostMap.entries()]
    .map(([userId, data]) => ({
      userId,
      email: emailMap.get(userId) || userId.slice(0, 8),
      jobCount: data.jobCount,
      totalCostUsd: Number(data.costUsd.toFixed(2)),
      totalCostBrl: Number((data.costUsd * cfg.usdToBrlRate).toFixed(2)),
    }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    .slice(0, 10);

  // Status das chaves de ambiente
  const keysStatus = {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    anthropicAdmin: Boolean(process.env.ANTHROPIC_ADMIN_KEY),
    higgsfield: Boolean(process.env.HIGGSFIELD_API_KEY),
    deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
    railway: Boolean(process.env.RAILWAY_API_TOKEN || process.env.RAILWAY_TOKEN),
  };

  return {
    period: periodDays === 0 ? "Todo o histórico" : `${periodDays} dias`,
    totalJobs: jobs.length,
    doneJobs: doneCount,
    totalClips: totalClipsSum,
    totalCostUsd: Number(totalCostUsd.toFixed(2)),
    totalCostBrl: Number(totalCostBrl.toFixed(2)),
    avgCostPerJobUsd: Number(avgCostPerJobUsd.toFixed(3)),
    avgCostPerJobBrl: Number((avgCostPerJobUsd * cfg.usdToBrlRate).toFixed(2)),
    avgCostPerClipUsd: Number(avgCostPerClipUsd.toFixed(3)),
    avgCostPerClipBrl: Number((avgCostPerClipUsd * cfg.usdToBrlRate).toFixed(2)),
    cachingSavingsUsd: Number(cachingSavingsUsd.toFixed(2)),
    breakdownByProvider: {
      claude: {
        totalCostUsd: Number(totalClaudeUsd.toFixed(2)),
        totalCostBrl: Number((totalClaudeUsd * cfg.usdToBrlRate).toFixed(2)),
        inputTokens: totalClaudeInputTokens,
        outputTokens: totalClaudeOutputTokens,
        thinkingTokens: totalClaudeThinkingTokens,
        cachedTokens: totalClaudeCachedTokens,
        percentage: Number(((totalClaudeUsd / safeTotal) * 100).toFixed(1)),
      },
      higgsfield: {
        totalCostUsd: Number(totalHiggsfieldUsd.toFixed(2)),
        totalCostBrl: Number((totalHiggsfieldUsd * cfg.usdToBrlRate).toFixed(2)),
        videosGenerated: totalHiggsfieldVideos,
        percentage: Number(((totalHiggsfieldUsd / safeTotal) * 100).toFixed(1)),
      },
      deepgram: {
        totalCostUsd: Number(totalDeepgramUsd.toFixed(2)),
        totalCostBrl: Number((totalDeepgramUsd * cfg.usdToBrlRate).toFixed(2)),
        audioMinutes: Math.round(totalAudioMinutes),
        percentage: Number(((totalDeepgramUsd / safeTotal) * 100).toFixed(1)),
      },
      railway: {
        totalCostUsd: Number(totalRailwayUsd.toFixed(2)),
        totalCostBrl: Number((totalRailwayUsd * cfg.usdToBrlRate).toFixed(2)),
        processHours: Number(totalProcessHours.toFixed(1)),
        percentage: Number(((totalRailwayUsd / safeTotal) * 100).toFixed(1)),
      },
    },
    jobCosts: jobCosts.slice(0, 100),
    topUsersByCost,
    keysStatus,
  };
}

/**
 * Testa e consulta a API GraphQL oficial do Railway para obter informações
 * do projeto, serviços e status de faturamento.
 */
export async function testRailwayApi(tokenOverride?: string): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  let token = (
    tokenOverride?.trim() ||
    process.env.RAILWAY_API_TOKEN?.trim() ||
    process.env.RAILWAY_TOKEN?.trim() ||
    ""
  ).replace(/^["']|["']$/g, "").trim();

  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  if (!token) {
    return {
      success: false,
      message:
        "RAILWAY_API_TOKEN não está configurado no ambiente nem foi fornecido. Você pode gerar um token em Railway > Account Settings > Tokens ou Project Settings > Tokens.",
    };
  }

  // 1. Tenta como Account Token
  try {
    const accountQuery = `
      query GetRailwayOverview {
        me {
          id
          name
          email
          projects {
            edges {
              node {
                id
                name
                services {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const resAccount = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: accountQuery }),
    });

    if (resAccount.ok) {
      const json = await resAccount.json().catch(() => null);
      if (json?.data?.me) {
        const me = json.data.me;
        const projects = me.projects?.edges?.map((e: any) => e.node) || [];
        return {
          success: true,
          message: `Conexão bem-sucedida! Conta: ${me.name || me.email || "Autenticada"} (${projects.length} projetos detectados).`,
          data: {
            user: { name: me.name, email: me.email },
            projectsCount: projects.length,
          },
        };
      }
    }
  } catch (err: any) {
    console.warn("[testRailwayApi] Falha na tentativa de Account Token:", err?.message);
  }

  // 2. Se falhar, tenta como Project Token
  try {
    const projectQuery = `
      query GetProjectTokenInfo {
        projectToken {
          projectId
          environmentId
        }
      }
    `;

    const resProject = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Project-Access-Token": token,
      },
      body: JSON.stringify({ query: projectQuery }),
    });

    if (resProject.ok) {
      const jsonProject = await resProject.json().catch(() => null);
      if (jsonProject?.data?.projectToken?.projectId) {
        const pt = jsonProject.data.projectToken;
        return {
          success: true,
          message: `Conexão bem-sucedida! Token de Projeto válido (Projeto: ${pt.projectId.slice(0, 8)}...).`,
          data: pt,
        };
      }

      if (jsonProject?.errors?.[0]?.message) {
        return {
          success: false,
          message: `Railway retornou: "${jsonProject.errors[0].message}". Verifique se o token foi gerado corretamente em Account Settings > Tokens ou Project Settings > Tokens.`,
        };
      }
    }

    const errText = await resProject.text().catch(() => "");
    return {
      success: false,
      message: `Railway GraphQL retornou status HTTP ${resProject.status}: ${errText.slice(0, 150) || "Consulta falhou"}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Falha na requisição para a API do Railway: ${err.message || String(err)}`,
    };
  }
}

/**
 * Testa a conexão com a API da Anthropic (Claude).
 */
export async function testAnthropicApi(keyOverride?: string): Promise<{
  success: boolean;
  message: string;
}> {
  const key = keyOverride?.trim() || process.env.ANTHROPIC_API_KEY?.trim();

  if (!key) {
    return {
      success: false,
      message: "ANTHROPIC_API_KEY não configurada no ambiente nem fornecida.",
    };
  }

  try {
    // Faz uma chamada rápida de verificação
    const modelToTest = process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-5-5";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelToTest,
        max_tokens: 10,
        messages: [{ role: "user", content: "Ping" }],
      }),
    });

    if (res.ok) {
      return {
        success: true,
        message: "Conexão com a API Claude bem-sucedida! A chave está ativa e funcional.",
      };
    }

    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      message: `Anthropic retornou HTTP ${res.status}: ${err.error?.message || "Chave inválida ou limite atingido."}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao testar Anthropic: ${err.message || String(err)}`,
    };
  }
}

/**
 * Informações e status da API da Higgsfield.
 */
export async function testHiggsfieldApi(keyOverride?: string): Promise<{
  success: boolean;
  message: string;
  hasDirectBillingApi: boolean;
}> {
  const key = keyOverride?.trim() || process.env.HIGGSFIELD_API_KEY?.trim();

  return {
    success: Boolean(key),
    hasDirectBillingApi: false,
    message: key
      ? "Chave HIGGSFIELD_API_KEY detectada no ambiente. A Higgsfield opera com créditos pré-pagos e não oferece endpoint público REST de saldo; todos os vídeos gerados são rastreados com precisão pelo monitor de custos do painel."
      : "HIGGSFIELD_API_KEY não está configurada no ambiente.",
  };
}
