import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "./actions";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cortes Virais",
  description: "Transforme vídeos longos em cortes prontos para as redes sociais.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase.from("usuarios").select("is_xandao").eq("id", user.id).maybeSingle();
    isAdmin = data?.is_xandao === true;
  }

  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand-logo">
              <span className="brand-icon">🎬</span>
              <span className="brand-text">Cortes Virais AI</span>
            </Link>

            <div className="topbar-right">
              {/* Badge de status com ponto verde pulsante */}
              <div className="system-status-badge" title="Servidor e IA prontos para processar">
                <span className="status-pulse-dot" />
                <span className="status-label">Sistema Online</span>
              </div>

              {user && (
                <nav className="user-nav">
                  <span className="user-email hide-sm">{user.email}</span>
                  {isAdmin && (
                    <Link href="/admin" className="navlink-admin">
                      Admin
                    </Link>
                  )}
                  <form action={signOut} style={{ display: "inline" }}>
                    <button className="btn-logout" title="Encerrar sessão">
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
