import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "./actions";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

import { ScissorsIcon, ShieldIcon, LogOutIcon, CrownIcon, CoinsIcon, HelpCircleIcon } from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Cortes AI",
  description: "Transforme vídeos longos em cortes prontos para as redes sociais.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let credits: number | null = null;
  if (user) {
    const { data } = await supabase
      .from("usuarios")
      .select("is_xandao, creditos_minutos")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = data?.is_xandao === true;
    credits = data?.creditos_minutos != null ? Number(data.creditos_minutos) : 30;
  }

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('cortes_theme');
                  var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand-logo">
              <span className="brand-icon-wrap">
                <ScissorsIcon size={19} />
              </span>
              <span className="brand-text">Cortes AI</span>
            </Link>

            <div className="topbar-right">
              {/* Badge de status com ponto verde pulsante */}
              <div className="system-status-badge" title="Servidor e IA prontos para processar">
                <span className="status-pulse-dot" />
                <span className="status-label">Sistema Online</span>
              </div>

              {/* Botão de Alternância de Tema (Dark / Light) */}
              <ThemeToggle />

              {user && (
                <nav className="user-nav">
                  <span className="user-email hide-sm">{user.email}</span>
                  {isAdmin ? (
                    <span
                      className="badge hide-sm"
                      style={{
                        background: "rgba(124, 58, 237, 0.2)",
                        color: "#c084fc",
                        border: "1px solid rgba(168, 85, 247, 0.4)",
                        fontSize: "0.75rem",
                        padding: "0.2rem 0.5rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                      title="Acesso VIP Ilimitado"
                    >
                      <CrownIcon size={12} /> VIP
                    </span>
                  ) : credits !== null ? (
                    <span
                      className="badge hide-sm"
                      style={{
                        background: credits > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: credits > 0 ? "#10b981" : "#ef4444",
                        border: `1px solid ${credits > 0 ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                        fontSize: "0.75rem",
                        padding: "0.2rem 0.5rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                      title="Saldo de minutos disponível"
                    >
                      <CoinsIcon size={12} /> {credits.toFixed(1)}m
                    </span>
                  ) : null}
                  <Link href="/ajuda" className="navlink-help" title="Central de Ajuda" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <HelpCircleIcon size={14} /> Ajuda
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="navlink-admin">
                      <ShieldIcon size={15} />
                      Admin
                    </Link>
                  )}
                  <form action={signOut} style={{ display: "inline" }}>
                    <button className="btn-logout" title="Encerrar sessão">
                      <LogOutIcon size={15} />
                      Sair
                    </button>
                  </form>
                </nav>
              )}
            </div>
          </div>
        </header>
        <main className="main-wrapper">{children}</main>
      </body>
    </html>
  );
}
