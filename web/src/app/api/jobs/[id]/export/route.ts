import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Clip, Job } from "@/lib/types";
import { buildTimelineProject } from "@/lib/export/timeline";
import { generateFcp7Xml } from "@/lib/export/fcp7xml";
import { generateEdl } from "@/lib/export/edl";
import { generateClipSrt } from "@/lib/export/srt";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") || "xml"; // "xml" | "edl" | "srt"
  const clipId = searchParams.get("clipId"); // para SRT de um clipe específico

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  // Consulta o job e seus clipes validados por RLS
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (jobErr || !job) {
    return new NextResponse("Job não encontrado", { status: 404 });
  }

  const { data: clips, error: clipsErr } = await supabase
    .from("clips")
    .select("*")
    .eq("job_id", id)
    .order("position");

  if (clipsErr || !clips || clips.length === 0) {
    return new NextResponse("Nenhum corte disponível para exportação", { status: 400 });
  }

  const project = buildTimelineProject(job as Job, clips as Clip[]);
  const safeName = (job.file_name ? job.file_name.replace(/\.[^/.]+$/, "") : `projeto_${job.id.slice(0, 8)}`)
    .replace(/[^\w\s-]/g, "")
    .trim();

  if (format === "xml") {
    const xmlContent = generateFcp7Xml(project);
    return new NextResponse(xmlContent, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}_Premiere_Resolve.xml"`,
      },
    });
  }

  if (format === "edl") {
    const edlContent = generateEdl(project);
    return new NextResponse(edlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.edl"`,
      },
    });
  }

  if (format === "srt") {
    // Se foi requisitado um clipe específico
    if (clipId) {
      const targetClip = (clips as Clip[]).find((c) => c.id === clipId);
      if (!targetClip) {
        return new NextResponse("Clipe não encontrado", { status: 404 });
      }
      const srtContent = generateClipSrt(targetClip);
      return new NextResponse(srtContent, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="corte_${String(targetClip.position).padStart(2, "0")}.srt"`,
        },
      });
    }

    // Se requisitou SRT geral de todos os clipes concatenados com índice
    let combinedSrt = "";
    (clips as Clip[]).forEach((c, idx) => {
      combinedSrt += `=== Corte ${c.position}: ${c.title} ===\n\n`;
      combinedSrt += generateClipSrt(c) + "\n\n";
    });

    return new NextResponse(combinedSrt, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}_legendas.srt"`,
      },
    });
  }

  return new NextResponse("Formato não suportado", { status: 400 });
}
