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
