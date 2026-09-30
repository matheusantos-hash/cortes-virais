"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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
