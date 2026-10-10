import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "./env";

export async function createClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o middleware já atualiza a sessão.
        }
      },
    },
  });
}

import { getAdminClient } from "./admin";

export async function checkAdmin(supabase: any): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: me } = await supabase
    .from("usuarios")
    .select("is_xandao, xandao")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.is_xandao === true || me?.xandao === 1) return true;

  try {
    const { data: rpcAdmin } = await supabase.rpc("is_admin");
    if (rpcAdmin === true) return true;
  } catch {}

  // Fallback seguro via admin client para garantir checagem sem bloqueio de RLS
  try {
    const admin = await getAdminClient(supabase);
    const { data: adminMe } = await admin
      .from("usuarios")
      .select("is_xandao, xandao")
      .eq("id", user.id)
      .maybeSingle();
    if (adminMe?.is_xandao === true || adminMe?.xandao === 1) return true;
  } catch {}

  return false;
}
