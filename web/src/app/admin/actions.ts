"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Atualiza o campo is_xandao de um usuário (somente admin pode executar). */
export async function setAdminFlag(userId: string, value: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Sem permissão" };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const { supabaseUrl } = await import("@/lib/supabase/env");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return { success: false, error: "SUPABASE_SERVICE_ROLE_KEY não configurada" };

  const admin = createAdmin(supabaseUrl(), serviceKey);
  const { error } = await admin.from("usuarios").update({ is_xandao: value }).eq("id", userId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

/** Atualiza o plano de pagamento de um usuário (somente admin). */
export async function setUserPlan(
  userId: string,
  data: { pagante: boolean; plano: string; plano_inicio: string | null; plano_fim: string | null; notas: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Sem permissão" };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const { supabaseUrl } = await import("@/lib/supabase/env");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return { success: false, error: "SUPABASE_SERVICE_ROLE_KEY não configurada" };

  const admin = createAdmin(supabaseUrl(), serviceKey);
  const { error } = await admin.from("usuarios").update({
    pagante: data.pagante,
    plano: data.plano || null,
    plano_inicio: data.plano_inicio || null,
    plano_fim: data.plano_fim || null,
    notas: data.notas || null,
  }).eq("id", userId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

/** Exclui um job (somente admin). */
export async function adminDeleteJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Sem permissão" };

  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

/** Atualiza os créditos e limites de minutos de um usuário manualmente (somente admin). */
export async function setUserCredits(
  userId: string,
  creditos_minutos: number,
  limite_max_video_minutos: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Sem permissão" };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const { supabaseUrl } = await import("@/lib/supabase/env");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return { success: false, error: "SUPABASE_SERVICE_ROLE_KEY não configurada" };

  const admin = createAdmin(supabaseUrl(), serviceKey);
  const { error } = await admin
    .from("usuarios")
    .update({
      creditos_minutos: Number(creditos_minutos),
      limite_max_video_minutos: Number(limite_max_video_minutos),
    })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

/** Exclui um clipe da biblioteca de clipes (somente admin). Remove da tabela clips e do Storage. */
export async function adminDeleteClip(clipId: string): Promise<{ success: boolean; error?: string }> {
  if (!clipId) return { success: false, error: "ID do clipe não fornecido" };
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Sem permissão de administrador" };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const { supabaseUrl } = await import("@/lib/supabase/env");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const admin = serviceKey ? createAdmin(supabaseUrl(), serviceKey) : supabase;

  // Busca dados do clipe para obter file_path antes de remover
  const { data: clip } = await admin
    .from("clips")
    .select("id, file_path")
    .eq("id", clipId)
    .maybeSingle();

  // Apaga do storage se tiver arquivo gravado
  if (clip?.file_path) {
    try {
      await admin.storage.from("clips").remove([clip.file_path]);
    } catch (e) {
      console.warn("[adminDeleteClip] aviso ao remover do storage:", e);
    }
  }

  // Apaga da tabela clips
  const { error } = await admin.from("clips").delete().eq("id", clipId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

/** Exclui múltiplos clipes da biblioteca em lote (somente admin). */
export async function adminDeleteClipsBatch(clipIds: string[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!clipIds || clipIds.length === 0) return { success: true, count: 0 };
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, count: 0, error: "Sem permissão de administrador" };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const { supabaseUrl } = await import("@/lib/supabase/env");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const admin = serviceKey ? createAdmin(supabaseUrl(), serviceKey) : supabase;

  // Busca caminhos para remoção do storage
  const { data: clips } = await admin.from("clips").select("file_path").in("id", clipIds);
  const paths = (clips ?? []).map((c) => c.file_path).filter(Boolean) as string[];
  if (paths.length > 0) {
    try {
      await admin.storage.from("clips").remove(paths);
    } catch (e) {
      console.warn("[adminDeleteClipsBatch] aviso ao remover do storage:", e);
    }
  }

  const { error } = await admin.from("clips").delete().in("id", clipIds);
  if (error) return { success: false, count: 0, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true, count: clipIds.length };
}
