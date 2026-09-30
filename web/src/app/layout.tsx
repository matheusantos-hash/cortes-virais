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
    const { data } = await supabase.from("usuarios").select("xandao").eq("id", user.id).maybeSingle();
    isAdmin = data?.xandao === 1;
  }

  return (
    <html lang="pt-BR">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            ✂️ Cortes Virais
          </Link>
          {user && (
            <nav className="row">
              <span className="muted small hide-sm">{user.email}</span>
              {isAdmin && (
                <Link href="/admin" className="navlink">
                  Admin
                </Link>
              )}
              <form action={signOut}>
                <button className="link">Sair</button>
              </form>
            </nav>
          )}
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
