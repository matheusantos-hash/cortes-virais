import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeToken(token?: string): string {
  if (!token) return "";
  let clean = token.trim();
  clean = clean.replace(/^["']|["']$/g, "").trim();
  if (clean.toLowerCase().startsWith("bearer ")) {
    clean = clean.slice(7).trim();
  }
  return clean;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Não autenticado." },
        { status: 401 }
      );
    }

    const { data: me } = await supabase
      .from("usuarios")
      .select("is_xandao")
      .eq("id", user.id)
      .maybeSingle();

    if (!me?.is_xandao) {
      return NextResponse.json(
        { success: false, message: "Acesso restrito ao painel administrativo." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const provider = body.provider || "railway";

    if (provider === "railway") {
      const rawToken =
        body.token ||
        process.env.RAILWAY_API_TOKEN ||
        process.env.RAILWAY_TOKEN;
      const cleanToken = sanitizeToken(rawToken);

      if (!cleanToken) {
        return NextResponse.json({
          success: false,
          message:
            "Nenhum token do Railway foi fornecido ou encontrado nas variáveis RAILWAY_API_TOKEN / RAILWAY_TOKEN.",
        });
      }

      // 1. Tenta como Account Token (Authorization: Bearer <token>) na API v2
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

      try {
        const resAccount = await fetch("https://backboard.railway.com/graphql/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanToken}`,
          },
          body: JSON.stringify({ query: accountQuery }),
        });

        if (resAccount.ok) {
          const jsonAccount = await resAccount.json().catch(() => null);
          if (jsonAccount?.data?.me) {
            const meData = jsonAccount.data.me;
            const projects = meData.projects?.edges?.map((e: any) => e.node) || [];
            const accountIdentifier = meData.name || meData.email || "Autenticada";
            return NextResponse.json({
              success: true,
              tokenType: "account",
              message: `Conexão bem-sucedida! Conta Railway: "${accountIdentifier}" (${projects.length} projetos vinculados).`,
              data: {
                user: { name: meData.name, email: meData.email },
                projectsCount: projects.length,
              },
            });
          }
        }
      } catch (err: any) {
        console.warn("[testRailwayApi] Falha na tentativa de Account Token:", err?.message);
      }

      // 2. Se não funcionou como Account Token, tenta como Project Token (Project-Access-Token: <token>)
      const projectQuery = `
        query GetProjectTokenInfo {
          projectToken {
            projectId
            environmentId
          }
        }
      `;

      try {
        const resProject = await fetch("https://backboard.railway.com/graphql/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Project-Access-Token": cleanToken,
          },
          body: JSON.stringify({ query: projectQuery }),
        });

        if (resProject.ok) {
          const jsonProject = await resProject.json().catch(() => null);
          if (jsonProject?.data?.projectToken?.projectId) {
            const pt = jsonProject.data.projectToken;
            return NextResponse.json({
              success: true,
              tokenType: "project",
              message: `Conexão bem-sucedida! Token de Projeto válido (Projeto ID: ${pt.projectId.slice(0, 8)}...).`,
              data: pt,
            });
          }

          if (jsonProject?.errors?.[0]?.message) {
            return NextResponse.json({
              success: false,
              message: `Railway retornou: "${jsonProject.errors[0].message}". Verifique se o token é válido em Account Settings > Tokens ou Project Settings > Tokens.`,
            });
          }
        } else {
          const errText = await resProject.text().catch(() => "");
          return NextResponse.json({
            success: false,
            message: `Railway retornou status HTTP ${resProject.status}: ${errText.slice(0, 150) || "Requisição falhou"}`,
          });
        }
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          message: `Falha na requisição de rede para Railway: ${err?.message || String(err)}`,
        });
      }

      return NextResponse.json({
        success: false,
        message:
          "Token não autorizado pela Railway. Gere um Account Token em railway.com > Account Settings > Tokens, ou um Project Token no seu Projeto.",
      });
    }

    if (provider === "claude") {
      const key =
        sanitizeToken(body.key) ||
        process.env.ANTHROPIC_API_KEY?.trim();

      if (!key) {
        return NextResponse.json({
          success: false,
          message: "ANTHROPIC_API_KEY não configurada no ambiente nem fornecida.",
        });
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-5-5",
          max_tokens: 10,
          messages: [{ role: "user", content: "Ping" }],
        }),
      });

      if (res.ok) {
        return NextResponse.json({
          success: true,
          message: "Conexão com a API Claude bem-sucedida! A chave está ativa e funcional.",
        });
      }

      const errData = await res.json().catch(() => ({}));
      return NextResponse.json({
        success: false,
        message: `Anthropic retornou HTTP ${res.status}: ${errData.error?.message || "Chave inválida ou limite atingido."}`,
      });
    }

    if (provider === "higgsfield") {
      const key =
        sanitizeToken(body.key) ||
        process.env.HIGGSFIELD_API_KEY?.trim();

      return NextResponse.json({
        success: Boolean(key),
        message: key
          ? "Chave HIGGSFIELD_API_KEY detectada no ambiente. A Higgsfield opera com créditos pré-pagos e não oferece endpoint público REST de saldo; todos os vídeos gerados são rastreados pelo monitor de custos."
          : "HIGGSFIELD_API_KEY não está configurada no ambiente.",
      });
    }

    return NextResponse.json(
      { success: false, message: "Provedor desconhecido." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[api/admin/test-provider] Erro inesperado:", err);
    return NextResponse.json(
      {
        success: false,
        message: `Erro interno no servidor ao testar provedor: ${err?.message || String(err)}`,
      },
      { status: 200 }
    );
  }
}
