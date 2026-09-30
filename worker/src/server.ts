import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CanceledError, downloadVideo, probeDuration, tryDirectDownload } from "./media.js";
import { processVideo } from "./pipeline.js";
import type { Options, Orientation } from "./types.js";

const rawUrl = process.env.SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!rawUrl || !SERVICE_KEY) {
  console.error("Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

// Aceita só a "origem" da URL (https://xxxx.supabase.co). Barra no final ou caminhos
// extras (como /rest/v1) quebram as chamadas com "Invalid path specified in request URL".
let SUPABASE_URL: string;
try {
  SUPABASE_URL = new URL(rawUrl).origin;
} catch {
  console.error(`SUPABASE_URL inválida: "${rawUrl}". Use o formato https://xxxx.supabase.co`);
  process.exit(1);
}
if (SUPABASE_URL.includes("supabase.com")) {
  console.error(
    "SUPABASE_URL aponta para o painel do Supabase. Use o Project URL (https://xxxx.supabase.co), em Project Settings > API."
  );
  process.exit(1);
}

// A service_role ignora o RLS: esta chave só pode existir no servidor.
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_VIDEO_MINUTES = Number(process.env.MAX_VIDEO_MINUTES ?? 120);
const POLL_MS = 5000;
const IN_PROGRESS = ["downloading", "transcribing", "analyzing", "cutting"];

interface Job {
  id: string;
  user_id: string;
  source_type: "link" | "drive" | "upload";
  source_url: string | null;
  source_path: string | null;
  orientation: Orientation;
  vertical_mode?: "blur" | "crop" | "split";
  crop_x: number | string;
  clip_count: number;
  min_seconds: number;
  max_seconds: number;
  language: string;
  reference_type?: "link" | "upload" | "preset" | "none";
  reference_url?: string | null;
  reference_path?: string | null;
  reference_style?: string | null;
  design_instructions?: string | null;
  use_broll?: boolean;
  broll_source?: "pexels" | "higgsfield" | "none";
}

/** Erro com mensagem segura para mostrar ao usuário. Os demais viram uma mensagem genérica. */
class UserError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let stopping = false;

function timeStamp(): string {
  const d = new Date();
  return d.toTimeString().split(" ")[0]; // "HH:MM:SS"
}

async function updateJob(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("jobs").update(patch).eq("id", id);
  if (error) {
    console.error(`[${id}] falha ao atualizar o job:`, error.message);
    if (patch.status === "canceled" && (error.message.includes("jobs_status_check") || error.message.includes("check constraint"))) {
      await supabase.from("jobs").update({ ...patch, status: "failed" }).eq("id", id);
    }
  }
}

async function claimNextJob(): Promise<Job | null> {
  const { data, error } = await supabase.rpc("claim_next_job");
  if (error) throw new Error(`claim_next_job: ${error.message}`);
  return (data as Job[] | null)?.[0] ?? null;
}

/** Baixa o arquivo enviado pelo usuário (bucket "sources") direto para o disco. */
async function downloadUpload(storagePath: string, dest: string, signal?: AbortSignal) {
  const { data, error } = await supabase.storage.from("sources").createSignedUrl(storagePath, 3600);
  if (error || !data) throw new UserError("Não encontrei o arquivo enviado. Envie o vídeo novamente.");
  const res = await fetch(data.signedUrl, { signal });
  if (!res.ok || !res.body) throw new UserError("Não consegui ler o arquivo enviado. Envie o vídeo novamente.");
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest), { signal });
}

async function processJob(job: Job) {
  const workDir = path.join(os.tmpdir(), "cortes-virais", job.id);
  const logs: string[] = [];
  const abortCtrl = new AbortController();
  let syncTimer: NodeJS.Timeout | null = null;
  let hasPendingLogs = false;

  const pushLog = async (msg: string) => {
    const formatted = `[${timeStamp()}] ${msg}`;
    logs.push(formatted);
    console.log(`[${job.id}] ${msg}`);
    hasPendingLogs = true;
  };

  const flushLogs = async () => {
    if (!hasPendingLogs) return;
    hasPendingLogs = false;
    await updateJob(job.id, { logs: [...logs] });
  };

  // Sincroniza logs periodicamente para não saturar requisições
  const startLogSync = () => {
    syncTimer = setInterval(() => {
      if (hasPendingLogs) flushLogs().catch(() => {});
    }, 1000);
  };

  const stopLogSync = () => {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  };

  const checkCanceled = async () => {
    if (abortCtrl.signal.aborted) {
      throw new CanceledError();
    }
    const { data, error } = await supabase
      .from("jobs")
      .select("status, error")
      .eq("id", job.id)
      .single();

    if (!error && (data?.status === "canceled" || data?.error?.includes("Cancelado pelo usuário") || (data?.status === "failed" && data?.error?.includes("Cancelado")))) {
      abortCtrl.abort();
      throw new CanceledError();
    }
  };

  // Monitor em segundo plano para capturar cancelamento via interface web rapidamente
  const cancelWatcher = setInterval(() => {
    checkCanceled().catch(() => {});
  }, 2000);

  console.log(`\n=== Job ${job.id} (${job.source_type}) ===`);

  try {
    startLogSync();
    await pushLog(`Inicializando processamento do pedido [${job.id}]`);
    const vertMode = job.vertical_mode ?? "crop";
    await pushLog(`Configurações: Formato ${job.orientation} (Layout: ${vertMode}) | Meta: ${job.clip_count} clipes (${job.min_seconds}s a ${job.max_seconds}s) | Idioma: ${job.language}`);
    
    if (job.reference_style || job.reference_url || job.design_instructions) {
      if (job.reference_style) await pushLog(`[DESIGN] Estilo de Referência: ${job.reference_style}`);
      if (job.reference_url) await pushLog(`[DESIGN] Vídeo de Referência: ${job.reference_url}`);
      if (job.design_instructions) await pushLog(`[DESIGN] Diretrizes de Edição: "${job.design_instructions}"`);
    }
    if (job.use_broll) {
      await pushLog(`[B-ROLL] Inserção de vídeos de apoio ativada via ${job.broll_source ?? "pexels"}`);
    }
    await flushLogs();

    await mkdir(workDir, { recursive: true });
    const sourcePath = path.join(workDir, "source.mp4");

    await checkCanceled();

    // 1. Obter o vídeo
    await updateJob(job.id, { status: "downloading", progress: 5 });
    if (job.source_type === "upload") {
      await pushLog("Baixando arquivo enviado pelo usuário no Storage...");
      await flushLogs();
      await downloadUpload(job.source_path!, sourcePath, abortCtrl.signal);
      await pushLog("Arquivo transferido para ambiente de processamento local com sucesso.");
    } else if (job.source_type === "link") {
      try {
        await pushLog(`Analisando link de vídeo: ${job.source_url}`);
        await flushLogs();
        // 1º: link direto de arquivo (Box, Dropbox…). 2º: sites de vídeo via yt-dlp.
        let direct: "ok" | "not-direct" | "too-large" = "not-direct";
        try {
          direct = await tryDirectDownload(job.source_url!, sourcePath, abortCtrl.signal);
        } catch (err) {
          if (err instanceof CanceledError) throw err;
          console.error(`[${job.id}] download direto falhou, tentando yt-dlp:`, err);
          await rm(sourcePath, { force: true });
        }
        if (direct === "too-large") {
          throw new UserError("O arquivo desse link é grande demais para processar.");
        }
        if (direct === "not-direct") {
          await pushLog("Baixando stream de vídeo em alta qualidade com yt-dlp...");
          await flushLogs();
          await downloadVideo(job.source_url!, sourcePath, abortCtrl.signal);
        }
        await pushLog("Download do vídeo finalizado com sucesso.");
      } catch (err) {
        if (err instanceof CanceledError) throw err;
        if (err instanceof UserError) throw err;
        console.error(`[${job.id}] download do link falhou:`, err);
        throw new UserError(
          "Não foi possível baixar o vídeo desse link. Ele pode estar privado, bloqueado ou ter expirado. Gere um link novo ou envie o arquivo."
        );
      }
    } else {
      throw new UserError("Este tipo de origem ainda não é suportado.");
    }

    await checkCanceled();

    // 2. Limite de duração (controle de custo)
    let seconds: number;
    try {
      seconds = await probeDuration(sourcePath);
    } catch {
      throw new UserError("O arquivo baixado não parece ser um vídeo válido.");
    }
    const minutes = seconds / 60;
    await pushLog(`Duração detectada do vídeo: ${Math.floor(minutes)}m ${Math.floor(seconds % 60)}s (${seconds.toFixed(1)}s total)`);
    if (minutes > MAX_VIDEO_MINUTES) {
      throw new UserError(
        `O vídeo tem ${Math.round(minutes)} minutos. O limite é de ${MAX_VIDEO_MINUTES} minutos.`
      );
    }
    await updateJob(job.id, { progress: 20 });
    await flushLogs();

    // 3. Pipeline (áudio → transcrição → Claude → cortes)
    const opts: Options = {
      orientation: job.orientation,
      clips: job.clip_count,
      minSeconds: job.min_seconds,
      maxSeconds: job.max_seconds,
      language: job.language,
      verticalMode: job.vertical_mode ?? "crop",
      cropX: Number(job.crop_x),
      referenceType: job.reference_type,
      referenceUrl: job.reference_url,
      referencePath: job.reference_path,
      referenceStyle: job.reference_style,
      designInstructions: job.design_instructions,
      useBroll: job.use_broll ?? false,
      brollSource: job.broll_source ?? "pexels",
      force: false,
      dryRun: false,
    };

    const { clips, files } = await processVideo({
      sourcePath,
      workDir,
      opts,
      hooks: {
        onStage: async (status, progress) => {
          await updateJob(job.id, { status, progress });
        },
        onLog: async (msg) => {
          await pushLog(msg);
        },
        checkCanceled,
        signal: abortCtrl.signal,
      },
    });

    await checkCanceled();

    // 4. Enviar os clipes ao Storage e registrar no banco
    await pushLog("Iniciando upload dos clipes finalizados para o Storage Supabase...");
    await updateJob(job.id, { status: "cutting", progress: 95 });
    await flushLogs();

    const rows = [];
    for (const [i, clip] of clips.entries()) {
      await checkCanceled();
      const storagePath = `${job.user_id}/${job.id}/clip-${String(i + 1).padStart(2, "0")}.mp4`;
      const { error } = await supabase.storage
        .from("clips")
        .upload(storagePath, await readFile(files[i]), { contentType: "video/mp4", upsert: true });
      if (error) throw new Error(`upload do clipe ${i + 1} falhou: ${error.message}`);

      rows.push({
        job_id: job.id,
        user_id: job.user_id,
        position: i + 1,
        title: clip.title,
        hook: clip.hook,
        reason: clip.reason,
        score: Math.round(clip.score),
        start_seconds: clip.start,
        end_seconds: clip.end,
        file_path: storagePath,
      });
    }

    await supabase.from("clips").delete().eq("job_id", job.id);
    const { error: insertError } = await supabase.from("clips").insert(rows);
    if (insertError) throw new Error(`gravar clipes: ${insertError.message}`);

    await pushLog(`Concluído com sucesso! ${rows.length} clipes prontos para visualização e download.`);
    stopLogSync();

    await updateJob(job.id, {
      status: "done",
      progress: 100,
      error: null,
      logs: [...logs],
      finished_at: new Date().toISOString(),
    });
    console.log(`=== Job ${job.id} concluído: ${rows.length} clipes ===`);
  } catch (err: any) {
    stopLogSync();
    if (err instanceof CanceledError || abortCtrl.signal.aborted) {
      console.log(`[${job.id}] Job cancelado pelo usuário.`);
      await pushLog("Operação cancelada pelo usuário. Recursos temporários liberados.");
      await updateJob(job.id, {
        status: "canceled",
        error: "Cancelado pelo usuário.",
        logs: [...logs],
        finished_at: new Date().toISOString(),
      });
    } else {
      console.error(`[${job.id}] erro:`, err);
      const errMsg = err instanceof UserError ? err.message : "Falha ao processar o vídeo. Tente novamente.";
      await pushLog(`[ERRO] ${errMsg}`);
      await updateJob(job.id, {
        status: "failed",
        error: errMsg,
        logs: [...logs],
        finished_at: new Date().toISOString(),
      });
    }
  } finally {
    clearInterval(cancelWatcher);
    stopLogSync();
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log("Worker iniciado. Esperando jobs…");

  // Jobs que estavam em andamento quando o servidor caiu não terminam sozinhos.
  // (Válido enquanto houver UM único worker.)
  await supabase
    .from("jobs")
    .update({
      status: "failed",
      error: "Processamento interrompido (o servidor reiniciou). Envie o pedido de novo.",
      finished_at: new Date().toISOString(),
    })
    .in("status", IN_PROGRESS);

  const stop = () => {
    console.log("Encerrando após o job atual…");
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    try {
      const job = await claimNextJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      await processJob(job);
    } catch (err) {
      console.error("Erro no loop principal:", err);
      await sleep(POLL_MS * 2);
    }
  }
}

main();

