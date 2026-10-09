import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectWorkspace from "@/components/ProjectWorkspace";
import type { Project, Job, Clip } from "@/lib/types";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Busca dados do projeto
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  // 2. Busca jobs e clipes pertencentes a este projeto
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, clips:clips!clips_job_id_fkey (*)")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const allClips: Clip[] = [];
  if (jobs) {
    jobs.forEach((j: any) => {
      if (j.clips && Array.isArray(j.clips)) {
        allClips.push(...j.clips);
      }
    });
  }

  return (
    <ProjectWorkspace
      initialProject={project as Project}
      initialJobs={(jobs ?? []) as Job[]}
      initialClips={allClips}
      userId={user.id}
    />
  );
}
