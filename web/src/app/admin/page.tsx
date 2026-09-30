import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export interface AdminUsuario {
  id: string;
  email: string | null;
  is_xandao: boolean;
  xandao: number;
  pagante: boolean;
  plano: string | null;
  plano_inicio: string | null;
  plano_fim: string | null;
  notas: string | null;
  created_at: string;
}

export interface AdminStats {
  totalUsers: number;
  pagantes: number;
  totalJobs: number;
  done: number;
  failed: number;
  canceled: number;
  running: number;
  totalClips: number;
  avgDurationSeconds: number;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Barreira: só is_xandao = true entra
  const { data: me } = await supabase
    .from("usuarios")
    .select("is_xandao")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_xandao) notFound();

  // Carrega dados em paralelo
  const [
    { data: usersData },
    { data: jobsData },
    { data: clipsData },
  ] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id,email,is_xandao,xandao,pagante,plano,plano_inicio,plano_fim,notas,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select(
        "id,user_id,status,progress,error,created_at,started_at,finished_at,source_type,orientation,vertical_mode,clip_count,language,min_seconds,max_seconds"
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("clips")
      .select("id,job_id,user_id,score,start_seconds,end_seconds")
      .limit(5000),
  ]);

  const users = (usersData ?? []) as AdminUsuario[];
  const jobs = (jobsData ?? []) as Job[];
  const clips = clipsData ?? [];

  // Calcula stats gerais
  const stats: AdminStats = {
    totalUsers: users.length,
    pagantes: users.filter((u) => u.pagante).length,
    totalJobs: jobs.length,
    done: jobs.filter((j) => j.status === "done").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    canceled: jobs.filter((j) => j.status === "canceled").length,
    running: jobs.filter((j) => !["done", "failed", "canceled"].includes(j.status)).length,
    totalClips: clips.length,
    avgDurationSeconds:
      clips.length > 0
        ? Math.round(
            clips.reduce((acc, c) => acc + ((c as any).end_seconds - (c as any).start_seconds), 0) /
              clips.length
          )
        : 0,
  };

  return <AdminDashboard users={users} jobs={jobs} stats={stats} />;
}
