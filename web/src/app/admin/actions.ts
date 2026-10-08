"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Helper para verificar permissão de administrador via tabela usuarios e RPC */
async function checkAdmin(supabase: any): Promise<boolean> {
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
    const admin = await getAdminClient();
    const { data: adminMe } = await admin
      .from("usuarios")
      .select("is_xandao, xandao")
      .eq("id", user.id)
      .maybeSingle();
    if (adminMe?.is_xandao === true || adminMe?.xandao === 1) return true;
  } catch {}

  return false;
}

/** Obtém cliente Supabase com chave de serviço (ignora RLS) ou recai no cliente autenticado */
async function getAdminClient(fallbackClient?: any) {
  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const { supabaseUrl, supabaseServiceRoleKey } = await import("@/lib/supabase/env");

  const key = supabaseServiceRoleKey(false);
  if (key) {
    return createAdmin(supabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  if (fallbackClient) {
    return fallbackClient;
  }

  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

/** Atualiza o campo is_xandao / xandao de um usuário (somente admin pode executar). */
export async function setAdminFlag(userId: string, value: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) return { success: false, error: "Sem permissão" };

  try {
    const admin = await getAdminClient(supabase);
    const { error } = await admin
      .from("usuarios")
      .update({ is_xandao: value, xandao: value ? 1 : 0 })
      .eq("id", userId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao atualizar permissão" };
  }
}

/** Atualiza o plano de pagamento de um usuário (somente admin). */
export async function setUserPlan(
  userId: string,
  data: { pagante: boolean; plano: string; plano_inicio: string | null; plano_fim: string | null; notas: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) return { success: false, error: "Sem permissão" };

  try {
    const admin = await getAdminClient(supabase);
    const { error } = await admin
      .from("usuarios")
      .update({
        pagante: data.pagante,
        plano: data.plano || null,
        plano_inicio: data.plano_inicio || null,
        plano_fim: data.plano_fim || null,
        notas: data.notas || null,
      })
      .eq("id", userId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao atualizar plano" };
  }
}

/** Exclui um job (somente admin). Limpa arquivos de Storage e registros vinculados. */
export async function adminDeleteJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  if (!jobId) return { success: false, error: "ID do job não fornecido" };
  const supabase = await createClient();
  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) return { success: false, error: "Sem permissão de administrador" };

  try {
    const admin = await getAdminClient(supabase);

    // 1. Busca dados do job para limpeza prévia do Storage
    const { data: job } = await admin
      .from("jobs")
      .select("id, source_path, source_type, reference_path")
      .eq("id", jobId)
      .maybeSingle();

    // 2. Busca clipes gerados por este job
    const { data: clips } = await admin
      .from("clips")
      .select("id, file_path")
      .eq("job_id", jobId);

    const clipList = (clips ?? []) as Array<{ id: string; file_path?: string | null }>;
    const clipIds = clipList.map((c) => c.id);
    const clipPaths = clipList.map((c) => c.file_path).filter(Boolean) as string[];

    // 3. Remove eventuais jobs de trimming que apontem para esses clipes
    if (clipIds.length > 0) {
      await admin.from("jobs").delete().in("target_clip_id", clipIds);
    }

    // 4. Limpa mídias do Storage
    if (job?.source_type === "upload" && job?.source_path) {
      try {
        await admin.storage.from("sources").remove([job.source_path]);
      } catch (e) {
        console.warn("[adminDeleteJob] aviso ao remover source do storage:", e);
      }
    }
    if (job?.reference_path) {
      try {
        await admin.storage.from("sources").remove([job.reference_path]);
      } catch (e) {
        console.warn("[adminDeleteJob] aviso ao remover reference do storage:", e);
      }
    }
    if (clipPaths.length > 0) {
      try {
        await admin.storage.from("clips").remove(clipPaths);
      } catch (e) {
        console.warn("[adminDeleteJob] aviso ao remover clipes do storage:", e);
      }
    }

    // 5. Remove clipes filhos e o job
    await admin.from("clips").delete().eq("job_id", jobId);
    const { error } = await admin.from("jobs").delete().eq("id", jobId);
    if (error) {
      console.error("[adminDeleteJob] erro ao excluir job:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("[adminDeleteJob] exceção:", err);
    return { success: false, error: err?.message || "Erro ao excluir job" };
  }
}

/** Atualiza os créditos e limites de minutos de um usuário manualmente (somente admin). */
export async function setUserCredits(
  userId: string,
  creditos_minutos: number,
  limite_max_video_minutos: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) return { success: false, error: "Sem permissão" };

  try {
    const admin = await getAdminClient(supabase);
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
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao atualizar créditos" };
  }
}

/** Exclui um clipe da biblioteca de clipes (somente admin). Remove da tabela clips e do Storage. */
export async function adminDeleteClip(clipId: string): Promise<{ success: boolean; error?: string }> {
  if (!clipId) return { success: false, error: "ID do clipe não fornecido" };
  const supabase = await createClient();
  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) return { success: false, error: "Sem permissão de administrador" };

  try {
    const admin = await getAdminClient(supabase);

    // 1. Busca dados do clipe para obter file_path antes de remover
    const { data: clip, error: fetchErr } = await admin
      .from("clips")
      .select("id, file_path")
      .eq("id", clipId)
      .maybeSingle();

    if (fetchErr) {
      console.warn("[adminDeleteClip] aviso ao buscar clipe:", fetchErr);
    }

    // 2. Apaga do storage se tiver arquivo gravado
    if (clip?.file_path) {
      try {
        await admin.storage.from("clips").remove([clip.file_path]);
      } catch (e) {
        console.warn("[adminDeleteClip] aviso ao remover do storage:", e);
      }
    }

    // 3. Remove eventuais jobs de trimming que apontem para este clipe
    try {
      await admin.from("jobs").delete().eq("target_clip_id", clipId);
    } catch {}

    // 4. Apaga da tabela clips
    const { error: delErr } = await admin.from("clips").delete().eq("id", clipId);
    if (delErr) {
      console.error("[adminDeleteClip] erro ao deletar:", delErr);
      return { success: false, error: delErr.message };
    }

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("[adminDeleteClip] exceção:", err);
    return { success: false, error: err?.message || "Erro interno ao excluir clipe" };
  }
}

/** Exclui múltiplos clipes da biblioteca em lote (somente admin). */
export async function adminDeleteClipsBatch(clipIds: string[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!clipIds || clipIds.length === 0) return { success: true, count: 0 };
  const supabase = await createClient();
  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) return { success: false, count: 0, error: "Sem permissão de administrador" };

  try {
    const admin = await getAdminClient(supabase);

    // 1. Busca caminhos para remoção do storage
    const { data: clips } = await admin.from("clips").select("file_path").in("id", clipIds);
    const clipList = (clips ?? []) as Array<{ file_path?: string | null }>;
    const paths = clipList.map((c) => c.file_path).filter(Boolean) as string[];
    if (paths.length > 0) {
      try {
        await admin.storage.from("clips").remove(paths);
      } catch (e) {
        console.warn("[adminDeleteClipsBatch] aviso ao remover do storage:", e);
      }
    }

    // 2. Remove jobs filhos que apontem para estes clipes
    try {
      await admin.from("jobs").delete().in("target_clip_id", clipIds);
    } catch {}

    // 3. Apaga da tabela clips
    const { error: delErr } = await admin.from("clips").delete().in("id", clipIds);
    if (delErr) {
      console.error("[adminDeleteClipsBatch] erro ao deletar:", delErr);
      return { success: false, count: 0, error: delErr.message };
    }

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, count: clipIds.length };
  } catch (err: any) {
    console.error("[adminDeleteClipsBatch] exceção:", err);
    return { success: false, count: 0, error: err?.message || "Erro interno ao excluir lote" };
  }
}
