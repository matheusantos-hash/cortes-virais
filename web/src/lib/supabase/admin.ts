import { createClient as createAdmin } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "./env";
import { createClient } from "./server";

/** 
 * Obtém cliente Supabase com chave de serviço (ignora RLS) 
 * ou recai no cliente autenticado em caso de falha.
 */
export async function getAdminClient(fallbackClient?: any) {
  try {
    const key = supabaseServiceRoleKey(false);
    if (key) {
      return createAdmin(supabaseUrl(), key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  } catch (err) {
    console.warn("Falha ao inicializar o Admin Client:", err);
  }

  if (fallbackClient) {
    return fallbackClient;
  }

  return await createClient();
}
