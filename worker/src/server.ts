import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CanceledError, downloadVideo, probeDuration, probeSource, trimClip, tryDirectDownload } from "./media.js";
import { processVideo } from "./pipeline.js";
import type { Options, Orientation, VerticalMode } from "./types.js";

const rawUrl = process.env.SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!rawUrl || !SERVICE_KEY) {
  console.error("Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const WORKER_ID = process.env.WORKER_ID || `worker-${os.hostname()}-${process.pid}`;

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
  job_type?: "full" | "trim";
  target_clip_id?: string | null;
  trim_start?: number | null;
  trim_end?: number | null;
  locked_by?: string | null;
  source_type: "link" | "drive" | "upload" | "clip";
  file_name?: string | null;
  source_url: string | null;
  source_path: string | null;
  orientation: Orientation;
  vertical_mode?: VerticalMode;
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
  broll_source?: import("./types.js").BrollSource;
  subtitle_style?: import("./types.js").SubtitleStyle;
  enable_sfx?: boolean;
  enable_emojis?: boolean;
  manual_adjustments?: Record<string, any> | null;
  export_settings?: Record<string, any> | null;
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
  const { data, error } = await supabase.rpc("claim_next_job", { p_worker_id: WORKER_ID });
  if (error) throw new Error(`claim_next_job: ${error.message}`);
  return (data as Job[] | null)?.[0] ?? null;
}

/** Baixa o arquivo do Storage (bucket "sources" ou "clips") direto para o disco. */
async function downloadFromStorage(bucket: "sources" | "clips", storagePath: string, dest: string, signal?: AbortSignal) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
  if (error || !data) throw new UserError(`Não encontrei o arquivo no bucket ${bucket}.`);
  const res = await fetch(data.signedUrl, { signal });
  if (!res.ok || !res.body) throw new UserError(`Não consegui ler o arquivo no bucket ${bucket}.`);
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest), { signal });
}

async function downloadUpload(storagePath: string, dest: string, signal?: AbortSignal) {
  return downloadFromStorage("sources", storagePath, dest, signal);
}

async function processJob(job: Job) {
  const workDir = path.join(os.tmpdir(), "cortes-virais", job.id);
  const logs: string[] = [];
  const abortCtrl = new AbortController();
  let syncTimer: NodeJS.Timeout | null = null;
  let hasPendingLogs = false;
  let debitedMinutes = 0;

  const pushLog = async (msg: string) => {
    const formatted = `[${timeStamp()}] ${msg}`;
    logs.push(formatted);
    console.log(`[${job.id}] ${msg}`);
    hasPendingLogs = true;
  };

  const flushLogs = async () => {
    if (!hasPendingLogs) return;
    hasPendingLogs = false;
    // Limita aos últimos 200 logs para manter queries leves no banco
    await updateJob(job.id, { logs: logs.slice(-200) });
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

  console.log(`\n=== Job ${job.id} (${job.job_type ?? "full"} - ${job.source_type}) [Worker: ${WORKER_ID}] ===`);

  // Heartbeat ativo a cada 15 segundos para renovar lease com o banco de dados
  const heartbeatTimer = setInterval(() => {
    supabase.rpc("job_heartbeat", { p_job_id: job.id, p_worker_id: WORKER_ID }).then(() => {}, () => {});
  }, 15000);

  try {
    startLogSync();
    await pushLog(`Inicializando processamento do pedido [${job.id}] no worker ${WORKER_ID}`);

    // Fluxo Especial: Job de Trim (Ajuste milimétrico de clipe existente)
    if (job.job_type === "trim") {
      await pushLog(`[TRIM] Re-renderizando clipe ajustado com precisão milimétrica...`);
      await updateJob(job.id, { status: "cutting", progress: 20 });
      await flushLogs();

      if (!job.target_clip_id) {
        throw new UserError("ID do clipe alvo não fornecido para o ajuste.");
      }

      const { data: clip, error: clipErr } = await supabase
        .from("clips")
        .select("*")
        .eq("id", job.target_clip_id)
        .single();

      if (clipErr || !clip || !clip.file_path) {
        throw new UserError("Clipe original não encontrado para re-corte.");
      }

      await mkdir(workDir, { recursive: true });
      const currentClipPath = path.join(workDir, "current_clip.mp4");
      const trimmedClipPath = path.join(workDir, "trimmed_clip.mp4");

      await pushLog("Baixando arquivo do corte atual para reprocessamento...");
      await downloadFromStorage("clips", clip.file_path, currentClipPath, abortCtrl.signal);

      const trimStart = Number(job.trim_start ?? 0);
      const trimEnd = Number(job.trim_end ?? (Number(clip.end_seconds) - Number(clip.start_seconds)));

      await updateJob(job.id, { progress: 50 });
      await trimClip({
        input: currentClipPath,
        output: trimmedClipPath,
        trimStartSec: trimStart,
        trimEndSec: trimEnd,
        signal: abortCtrl.signal,
        onLog: pushLog,
      });

      await updateJob(job.id, { progress: 85 });
      await pushLog("Enviando vídeo recortado e atualizado para o Storage...");

      const newVersion = (clip.version || 1) + 1;
      const newStoragePath = `${clip.user_id}/${clip.job_id}/clip-${String(clip.position).padStart(2, "0")}-v${newVersion}.mp4`;

      const { error: uploadErr } = await supabase.storage
        .from("clips")
        .upload(newStoragePath, await readFile(trimmedClipPath), { contentType: "video/mp4", upsert: true });

      if (uploadErr) {
        throw new Error(`Falha no upload do clipe ajustado: ${uploadErr.message}`);
      }

      // Calcula os novos segundos absolutos
      const newAbsStart = Number(clip.start_seconds) + trimStart;
      const newAbsEnd = Number(clip.start_seconds) + trimEnd;

      const { error: updateClipErr } = await supabase
        .from("clips")
        .update({
          file_path: newStoragePath,
          version: newVersion,
          start_seconds: newAbsStart,
          end_seconds: newAbsEnd,
          is_trimming: false,
        })
        .eq("id", clip.id);

      if (updateClipErr) {
        throw new Error(`Falha ao atualizar dados do clipe no banco: ${updateClipErr.message}`);
      }

      await pushLog(`Ajuste de corte finalizado com sucesso! Nova versão v${newVersion} disponível.`);
      stopLogSync();

      await updateJob(job.id, {
        status: "done",
        progress: 100,
        error: null,
        logs: [...logs],
        finished_at: new Date().toISOString(),
      });
      console.log(`=== Job Trim ${job.id} concluído com sucesso ===`);
      return;
    }

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
          await downloadVideo(job.source_url!, sourcePath, abortCtrl.signal, pushLog);
        }
        await pushLog("Download do vídeo finalizado com sucesso.");
      } catch (err) {
        if (err instanceof CanceledError) throw err;
        if (err instanceof UserError) throw err;
        const rawErr = err instanceof Error ? err.message : String(err);
        console.error(`[${job.id}] download do link falhou:`, rawErr);
        await pushLog(`[ERRO] ${rawErr}`);
        await flushLogs();
        throw new UserError(
          "Não foi possível baixar o vídeo desse link. Ele pode estar privado, bloqueado ou ter expirado. Gere um link novo ou envie o arquivo."
        );
      }
    } else {
      throw new UserError("Este tipo de origem ainda não é suportado.");
    }

    await checkCanceled();

    // 1.1 Obter o vídeo de referência se fornecido (para clonagem de estilo)
    let localRefPath: string | null = null;
    if (job.reference_path) {
      try {
        localRefPath = path.join(workDir, "ref_source.mp4");
        await pushLog("Baixando vídeo modelo de referência enviado para clonagem de estilo...");
        await downloadUpload(job.reference_path, localRefPath, abortCtrl.signal);
        await pushLog("Vídeo de referência transferido com sucesso para análise de estilo.");
      } catch (err) {
        console.error(`[${job.id}] Falha ao baixar vídeo de referência:`, err);
        await pushLog("[AVISO] Não foi possível baixar o vídeo de referência do Storage. Prosseguindo com preset de estilo.");
        localRefPath = null;
      }
    } else if (job.reference_url) {
      try {
        localRefPath = path.join(workDir, "ref_source.mp4");
        await pushLog(`Baixando vídeo de referência do link: ${job.reference_url}...`);
        await downloadVideo(job.reference_url, localRefPath, abortCtrl.signal, pushLog);
        await pushLog("Vídeo de referência baixado com sucesso.");
      } catch (err) {
        console.error(`[${job.id}] Falha ao baixar link de referência:`, err);
        await pushLog("[AVISO] Não foi possível baixar o link da referência externa. Prosseguindo com preset de estilo.");
        localRefPath = null;
      }
    }

    // 2. Limite de duração e Verificação/Débito Atômico de Créditos
    let seconds: number;
    let sourceMeta: import("./types.js").SourceMeta | null = null;
    try {
      const originalFileName = job.file_name || (job.source_path ? path.basename(job.source_path) : "source.mp4");
      sourceMeta = await probeSource(sourcePath, originalFileName);
      seconds = sourceMeta.durationSec;
    } catch {
      try {
        seconds = await probeDuration(sourcePath);
      } catch {
        throw new UserError("O arquivo baixado não parece ser um vídeo válido.");
      }
    }
    const minutes = seconds / 60;
    const billedMinutes = Math.max(0.1, Math.round((seconds / 60) * 10) / 10);
    const fpsStr = sourceMeta ? `${(sourceMeta.fpsNum / sourceMeta.fpsDen).toFixed(2)} fps` : "fps padrão";
    await pushLog(`Duração detectada do vídeo: ${Math.floor(minutes)}m ${Math.floor(seconds % 60)}s (${seconds.toFixed(1)}s total | Cobrança: ${billedMinutes} min | ${fpsStr})`);
    if (sourceMeta?.vfr) {
      await pushLog(`[AVISO] Taxa de quadros variável (VFR) detectada. Recomendado usar CFR para edição profissional.`);
    }

    if (sourceMeta) {
      await updateJob(job.id, { source_meta: sourceMeta });
    }

    // Consulta limites e perfil do usuário no banco
    const { data: userData, error: userFetchErr } = await supabase
      .from("usuarios")
      .select("is_xandao, creditos_minutos, limite_max_video_minutos")
      .eq("id", job.user_id)
      .single();

    if (!userFetchErr && userData) {
      const isUserAdmin = Boolean(userData.is_xandao);
      const maxAllowed = Number(userData.limite_max_video_minutos ?? 60.0);

      if (!isUserAdmin && minutes > maxAllowed) {
        throw new UserError(
          `O vídeo tem ${minutes.toFixed(1)} minutos. O seu limite configurado é de ${maxAllowed} minutos por vídeo. Entre em contato ou faça upgrade no painel.`
        );
      }

      if (!isUserAdmin) {
        // Debita atomicamente via RPC debit_user_credits
        const { data: remainingCredits, error: debitErr } = await supabase.rpc("debit_user_credits", {
          p_user_id: job.user_id,
          p_minutes: billedMinutes,
        });

        if (debitErr) {
          console.error(`[${job.id}] Erro ao debitar créditos:`, debitErr.message);
        } else if (Number(remainingCredits) < 0) {
          const currentBal = Number(userData.creditos_minutos ?? 0).toFixed(1);
          throw new UserError(
            `Saldo insuficiente de créditos. Este vídeo requer ${billedMinutes} min, mas seu saldo atual é de ${currentBal} min. Fale com o suporte ou faça upgrade.`
          );
        } else {
          debitedMinutes = billedMinutes;
          await pushLog(`[CRÉDITOS] ${billedMinutes} min debitados com sucesso. Saldo restante: ${Number(remainingCredits).toFixed(1)} min.`);
        }
      } else {
        await pushLog(`[CRÉDITOS] Usuário Administrador (VIP): Isento de cobrança de créditos.`);
      }
    } else if (minutes > MAX_VIDEO_MINUTES) {
      throw new UserError(
        `O vídeo tem ${Math.round(minutes)} minutos. O limite é de ${MAX_VIDEO_MINUTES} minutos.`
      );
    }
    await updateJob(job.id, { progress: 20 });
    await flushLogs();

    // 3. Pipeline (áudio → transcrição → Claude → cortes)
    const manualAdj = (job.manual_adjustments as any) || {};
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
      referencePath: localRefPath,
      referenceStyle: job.reference_style,
      designInstructions: job.design_instructions,
      useBroll: job.use_broll ?? manualAdj?.brolls?.enabled ?? false,
      brollSource: job.broll_source ?? manualAdj?.brolls?.source ?? "pexels",
      subtitleStyle: job.subtitle_style ?? manualAdj?.subtitles?.style,
      highlightColor: manualAdj?.subtitles?.highlightColor,
      enableSfx: job.enable_sfx ?? manualAdj?.soundDesign?.enableSfx ?? true,
      enableEmojis: job.enable_emojis ?? manualAdj?.subtitles?.enableEmojis ?? true,
      dynamicZoom: manualAdj?.keyMoments?.smartPunchInZoom !== false,
      force: false,
      dryRun: false,
    };

    const { clips, files, editDecisions } = await processVideo({
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

      // Se houver b-rolls locais no clipe, faz upload opcional para bucket de clips para uso no NLE
      const clipDecision = editDecisions[i];
      if (clipDecision && clipDecision.brolls && clipDecision.brolls.length > 0) {
        for (const [bIdx, broll] of clipDecision.brolls.entries()) {
          if (broll.localPath && existsSync(broll.localPath)) {
            try {
              const brollStoragePath = `${job.user_id}/${job.id}/assets/clip-${String(i + 1).padStart(2, "0")}-broll-${bIdx + 1}-${path.basename(broll.localPath)}`;
              await supabase.storage
                .from("clips")
                .upload(brollStoragePath, await readFile(broll.localPath), { contentType: "video/mp4", upsert: true });
              broll.storagePath = brollStoragePath;
            } catch (bErr) {
              console.warn(`[${job.id}] Aviso: falha ao armazenar broll no storage:`, bErr);
            }
          }
          delete broll.localPath;
        }
      }

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
        edit_decisions: clipDecision ?? null,
      });
    }

    await supabase.from("clips").delete().eq("job_id", job.id);
    const { error: insertError } = await supabase.from("clips").insert(rows);
    if (insertError) throw new Error(`gravar clipes: ${insertError.message}`);

    await pushLog(`Concluído com sucesso! ${rows.length} clipes prontos para visualização e download.`);
    stopLogSync();
    debitedMinutes = 0; // Cobrança consolidada com sucesso

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

    // Se houve débito prévio e o processamento não finalizou, estorna automaticamente
    if (debitedMinutes > 0) {
      try {
        await supabase.rpc("refund_user_credits", {
          p_user_id: job.user_id,
          p_minutes: debitedMinutes,
        });
        await pushLog(`[CRÉDITOS] Estorno automático de ${debitedMinutes} min devolvido à conta do usuário.`);
      } catch (refundErr) {
        console.error(`[${job.id}] Falha ao estornar créditos:`, refundErr);
      }
      debitedMinutes = 0;
    }

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
      const detailedErr = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
      const errMsg = err instanceof UserError ? err.message : detailedErr;
      await pushLog(`[ERRO DETALHADO] ${detailedErr}`);
      await flushLogs();
      await updateJob(job.id, {
        status: "failed",
        error: errMsg,
        logs: [...logs],
        finished_at: new Date().toISOString(),
      });
    }
  } finally {
    clearInterval(heartbeatTimer);
    clearInterval(cancelWatcher);
    stopLogSync();
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log(`Worker iniciado com ID [${WORKER_ID}]. Esperando jobs…`);

  // Resgata jobs que travaram no estado "em processamento" devido a restart abrupto de qualquer worker
  // (no Railway o hostname muda a cada deploy/restart, entao limpar pelo WORKER_ID atual falha)
  await supabase
    .from("jobs")
    .update({
      status: "failed",
      error: "Processamento interrompido (o servidor do worker foi reiniciado ou crashou).",
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

