"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "@/lib/supabase/env";

function getServiceClient(fallbackClient: any) {
  try {
    const key = supabaseServiceRoleKey();
    return createAdminClient(supabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return fallbackClient;
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Cancela um job em andamento pertencente ao usuário (ou por admin). */
export async function cancelJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  if (!jobId) return { success: false, error: "ID do job não fornecido" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Usuário não autenticado." };

  // 1. Verifica se o job existe e confere a posse (ou se é admin)
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, user_id, status")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return { success: false, error: "Pedido não encontrado ou sem permissão." };
  }

  if (job.user_id !== user.id) {
    const { data: me } = await supabase
      .from("usuarios")
      .select("is_xandao, xandao")
      .eq("id", user.id)
      .maybeSingle();

    const isUserAdmin = me?.is_xandao === true || me?.xandao === 1;
    if (!isUserAdmin) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (!isAdmin) {
        return { success: false, error: "Você não tem permissão para cancelar este pedido." };
      }
    }
  }

  if (["done", "failed", "canceled"].includes(job.status)) {
    return { success: true };
  }

  // 2. Tenta chamar a RPC 'cancel_job' se existir no Supabase
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc("cancel_job", { job_id: jobId });
    if (!rpcError && rpcResult) {
      revalidatePath(`/jobs/${jobId}`);
      revalidatePath("/");
      return { success: true };
    }
  } catch {
    // segue para fallback
  }

  // 3. Fallback: Se houver chave Service Role no ambiente, usa client com bypass de RLS
  const clientToUse = getServiceClient(supabase);

  const now = new Date().toISOString();
  let { error: updateError } = await clientToUse
    .from("jobs")
    .update({
      status: "canceled",
      finished_at: now,
      error: "Cancelado pelo usuário.",
    })
    .eq("id", jobId);

  // Se a tabela tiver constraint antiga que não inclui 'canceled', atualiza para 'failed'
  if (updateError && (updateError.message.includes("jobs_status_check") || updateError.message.includes("check constraint"))) {
    const { error: failedError } = await clientToUse
      .from("jobs")
      .update({
        status: "failed",
        finished_at: now,
        error: "Cancelado pelo usuário.",
      })
      .eq("id", jobId);
    updateError = failedError;
  }

  if (updateError) {
    console.error(`[cancelJob] erro ao atualizar job ${jobId}:`, updateError);
    if (updateError.message.includes("row-level security") || updateError.message.includes("policy")) {
      return {
        success: false,
        error: "Permissão de atualização negada pelo Supabase. Execute o script SQL no Supabase para liberar o cancelamento.",
      };
    }
    return { success: false, error: updateError.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/");
  return { success: true };
}

/** Exclui um job pertencente ao usuário, limpando também arquivos de mídia do Storage. */
export async function deleteUserJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  if (!jobId) return { success: false, error: "ID não fornecido" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const clientToUse = getServiceClient(supabase);

  // Busca dados de arquivos para limpeza prévia do Storage
  const { data: job } = await clientToUse
    .from("jobs")
    .select("source_path, source_type")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: clips } = await clientToUse
    .from("clips")
    .select("file_path")
    .eq("job_id", jobId)
    .eq("user_id", user.id);

  if (job?.source_type === "upload" && job?.source_path) {
    try {
      await clientToUse.storage.from("sources").remove([job.source_path]);
    } catch {}
  }
  const clipPaths = ((clips as any[]) ?? []).map((c: any) => c.file_path).filter(Boolean) as string[];
  if (clipPaths.length > 0) {
    try {
      await clientToUse.storage.from("clips").remove(clipPaths);
    } catch {}
  }

  const { error } = await clientToUse
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true };
}

/** Só admin (usuarios.xandao = 1). O RLS também barra quem não for. */
export async function deleteJob(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) throw new Error("Sem permissão");
  await supabase.from("jobs").delete().eq("id", id);
  revalidatePath("/admin");
}

/** Exclui um clipe individual pertencente ao usuário autenticado (ou por admin). Remove do Storage e da tabela clips. */
export async function deleteUserClip(clipId: string): Promise<{ success: boolean; error?: string }> {
  if (!clipId) return { success: false, error: "ID do clipe não fornecido." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Não autenticado." };

  const clientToUse = getServiceClient(supabase);

  try {
    // 1. Busca clipe para verificar se pertence ao usuário (ou se usuário é admin)
    const { data: clip, error: fetchErr } = await clientToUse
      .from("clips")
      .select("id, user_id, job_id, file_path")
      .eq("id", clipId)
      .maybeSingle();

    if (fetchErr || !clip) {
      return { success: false, error: "Clipe não encontrado." };
    }

    // Se não for dono direto, verifica se é admin
    if (clip.user_id !== user.id) {
      const { data: me } = await clientToUse
        .from("usuarios")
        .select("is_xandao, xandao")
        .eq("id", user.id)
        .maybeSingle();
      const isAdmin = me?.is_xandao === true || me?.xandao === 1;
      if (!isAdmin) {
        return { success: false, error: "Sem permissão para excluir este clipe." };
      }
    }

    // 2. Remove jobs filhos que dependam deste target_clip_id
    try {
      await clientToUse.from("jobs").delete().eq("target_clip_id", clipId);
    } catch {}

    // 3. Remove arquivo do bucket de Storage se houver
    if (clip.file_path) {
      try {
        await clientToUse.storage.from("clips").remove([clip.file_path]);
      } catch (e) {
        console.warn("[deleteUserClip] aviso ao remover do storage:", e);
      }
    }

    // 4. Remove o clipe da tabela
    const { error: delErr } = await clientToUse.from("clips").delete().eq("id", clipId);
    if (delErr) {
      console.error("[deleteUserClip] erro ao deletar:", delErr);
      return { success: false, error: delErr.message };
    }

    revalidatePath("/");
    if (clip.job_id) {
      revalidatePath(`/jobs/${clip.job_id}`);
    }
    revalidatePath("/admin");

    return { success: true };
  } catch (err: any) {
    console.error("[deleteUserClip] exceção:", err);
    return { success: false, error: err?.message || "Erro interno ao excluir clipe." };
  }
}

import type { CanvasBroll } from "@/lib/types";

/** Solicita o re-corte (trimming) do clipe com re-renderização milimétrica no worker, incluindo overlays Canvas */
export async function requestClipTrimAction(
  clipId: string,
  startSec: number,
  endSec: number,
  canvasBrolls?: CanvasBroll[]
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  if (!clipId) return { success: false, error: "ID do clipe não fornecido." };
  if (startSec < 0 || endSec <= startSec) {
    return { success: false, error: "Intervalo de corte inválido." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Usuário não autenticado." };

  try {
    const { data: jobId, error: rpcErr } = await supabase.rpc("request_clip_trim", {
      p_clip_id: clipId,
      p_start: startSec,
      p_end: endSec,
      p_canvas_brolls: canvasBrolls ?? null,
    });

    if (rpcErr) {
      return { success: false, error: rpcErr.message };
    }

    revalidatePath("/");
    return { success: true, jobId };
  } catch (err: any) {
    return { success: false, error: err?.message || "Falha ao solicitar ajuste de corte." };
  }
}

/** Salva B-Rolls Canvas configurados pelo usuário na tabela clips */
export async function saveClipCanvasBrollsAction(
  clipId: string,
  canvasBrolls: CanvasBroll[]
): Promise<{ success: boolean; error?: string }> {
  if (!clipId) return { success: false, error: "ID do clipe não fornecido." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Usuário não autenticado." };

  try {
    const { error: rpcErr } = await supabase.rpc("save_clip_canvas_brolls", {
      p_clip_id: clipId,
      p_canvas_brolls: canvasBrolls,
    });

    if (rpcErr) {
      // Fallback caso a RPC ainda não esteja instalada no banco
      const { error: updErr } = await supabase
        .from("clips")
        .update({ canvas_brolls: canvasBrolls })
        .eq("id", clipId);

      if (updErr) {
        return { success: false, error: updErr.message };
      }
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Falha ao salvar B-Rolls Canvas." };
  }
}


