import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectsOverview from "@/components/ProjectsOverview";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*, jobs:jobs(id, clips:clips!clips_job_id_fkey(id, file_path))")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <ProjectsOverview
      userId={user.id}
      initialProjects={(projects ?? []) as any}
    />
  );
}
