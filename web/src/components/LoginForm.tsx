"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ALLOW_SIGNUP = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(
          error.message.toLowerCase().includes("invalid login")
            ? "E-mail ou senha incorretos."
            : error.message
        );
        setBusy(false);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else if (data.session) {
      router.push("/");
      router.refresh();
      return;
    } else {
      setInfo("Conta criada. Confira seu e-mail para confirmar o cadastro.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h1>{mode === "login" ? "Entrar" : "Criar conta"}</h1>
      <label>
        E-mail
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label>
        Senha
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
      <button className="btn" disabled={busy}>
        {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
      </button>
      {ALLOW_SIGNUP && (
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "login" ? "Não tenho conta" : "Já tenho conta"}
        </button>
      )}
    </form>
  );
}
