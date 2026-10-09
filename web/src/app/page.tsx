import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: jobs }, { data: projects }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, clips:clips!clips_job_id_fkey (*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("projects")
      .select("*, jobs:jobs(id, clips:clips!clips_job_id_fkey(id, file_path))")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <Dashboard
      userId={user.id}
      initialJobs={(jobs ?? []) as Job[]}
      initialProjects={(projects ?? []) as any}
    />
  );
}
