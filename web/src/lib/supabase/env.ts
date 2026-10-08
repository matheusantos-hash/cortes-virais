/** Aceita só a origem da URL: barra no final ou /rest/v1 quebram as chamadas. */
export function supabaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  try {
    return new URL(raw).origin;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida. Use o formato https://xxxx.supabase.co");
  }
}

export function supabaseAnonKey(): string {
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!key) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local");
  return key;
}

export function supabaseServiceRoleKey(required = false): string {
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    ""
  ).trim();
  if (!key && required) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor (.env.local). Configure a chave secreta de serviço do Supabase para permitir exclusão e operações de administração."
    );
  }
  return key;
}
