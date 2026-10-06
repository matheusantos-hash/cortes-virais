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

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, clips:clips!clips_job_id_fkey (*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return <Dashboard userId={user.id} initialJobs={(jobs ?? []) as Job[]} />;
}
