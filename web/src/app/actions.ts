"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Cancela um job em andamento pertencente ao usuário. */
export async function cancelJob(jobId: string) {
  if (!jobId) return { error: "ID do job não fornecido" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // Tenta chamar a RPC 'cancel_job' se existir
  const { error: rpcError } = await supabase.rpc("cancel_job", { job_id: jobId });
  if (rpcError) {
    // Fallback: update direto
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "canceled",
        finished_at: new Date().toISOString(),
        error: "Cancelado pelo usuário.",
      })
      .eq("id", jobId)
      .eq("user_id", user.id);
    if (updateError) return { error: updateError.message };
  }

  revalidatePath(`/jobs/${jobId}`);
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

