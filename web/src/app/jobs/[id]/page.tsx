import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import JobView from "@/components/JobView";
import { ArrowLeft } from "@/components/Icons";
import { createClient } from "@/lib/supabase/server";
import type { Clip, Job } from "@/lib/types";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // O RLS garante: o dono vê o próprio job; o admin vê qualquer um.
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const { data: clips } = await supabase.from("clips").select("*").eq("job_id", id).order("position");

  return (
    <div className="stack-lg">
      <Link href="/" className="link" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
        <ArrowLeft size={16} /> Voltar
      </Link>
      <JobView initialJob={job as Job} initialClips={(clips ?? []) as Clip[]} />
    </div>
  );
}
