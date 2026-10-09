import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBlocks, findCandidates, selectClips } from "./analyze.js";
import { analyzeVideoVisuals } from "./gemini_video.js";
import { fetchHiggsfieldBroll } from "./higgsfield.js";
import { type ActiveBroll, CanceledError, cutClip, extractAudio } from "./media.js";
import { fetchStockBroll } from "./stock.js";
import { extractReferenceStyle } from "./ref_analyzer.js";
import { generateViralAssSubtitles } from "./subtitles.js";
import { type SfxEvent } from "./sfx.js";
import { transcribeAudio } from "./transcribe.js";
import type { Clip, Options, Word } from "./types.js";

export type Stage = "transcribing" | "analyzing" | "cutting";

export interface Hooks {
  /** Chamado ao entrar em cada etapa, com o progresso (0–100) do job. */
  onStage?: (stage: Stage, progress: number) => void | Promise<void>;
  /** Chamado para registrar logs de execução do backend */
  onLog?: (message: string) => void | Promise<void>;
  /** Verifica se o job foi cancelado e lança CanceledError se necessário */
  checkCanceled?: () => Promise<void> | void;
  /** Signal para cancelar subprocessos */
  signal?: AbortSignal;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

const fmt = (sec: number) => {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Do vídeo já em disco até os clipes prontos:
 * áudio → transcrição → Claude → validação → cortes.
 * Usado tanto pelo modo linha de comando quanto pelo servidor (Supabase).
 */
export async function processVideo(args: {
  sourcePath: string;
  workDir: string;
  opts: Options;
  hooks?: Hooks;
}): Promise<{ clips: Clip[]; files: string[]; editDecisions: import("./types.js").ClipEditDecisions[] }> {
  const { sourcePath, workDir, opts, hooks } = args;

  await hooks?.checkCanceled?.();

  // Áudio
  const audioPath = path.join(workDir, "audio.mp3");
  if (opts.force || !existsSync(audioPath)) {
    await hooks?.onLog?.("Extraindo áudio do vídeo para transcrição (FFmpeg)...");
    console.log("Extraindo o áudio…");
    await extractAudio(sourcePath, audioPath, hooks?.signal);
  }

  await hooks?.checkCanceled?.();

  // Transcrição (em cache no disco, para não pagar de novo ao ajustar o prompt)
  await hooks?.onStage?.("transcribing", 25);
  const transcriptPath = path.join(workDir, "transcript.json");
  let words: Word[];
  if (opts.force || !existsSync(transcriptPath)) {
    const prov = opts.transcriptionProvider ?? "auto";
    const res = await transcribeAudio({
      audioPath,
      language: opts.language,
      provider: prov,
      onLog: hooks?.onLog ? (msg) => hooks.onLog?.(msg) : undefined,
    });
    words = res.words;
    await writeFile(transcriptPath, JSON.stringify(words));
    if (res.audioTags && res.audioTags.length > 0) {
      await writeFile(path.join(workDir, "audio_tags.json"), JSON.stringify(res.audioTags, null, 2));
    }
  } else {
    await hooks?.onLog?.("Transcrição existente encontrada em cache, reutilizando.");
    console.log("Transcrição já existe, reaproveitando.");
    words = JSON.parse(await readFile(transcriptPath, "utf8"));
  }

  await hooks?.checkCanceled?.();

  const blocks = buildBlocks(words);
  const wordCountMsg = `Transcrição concluída: ${words.length} palavras identificadas agrupadas em ${blocks.length} blocos de contexto.`;
  await hooks?.onLog?.(wordCountMsg);
  console.log(`  ${words.length} palavras, ${blocks.length} blocos.`);

  // Claude escolhe os trechos
  await hooks?.onStage?.("analyzing", 50);

  // Extrai perfil de estilo do vídeo de referência caso fornecido
  if (!opts.styleBlueprint && opts.referencePath && existsSync(opts.referencePath)) {
    await hooks?.onLog?.("Iniciando extração do estilo de edição do vídeo de referência com IA...");
    opts.styleBlueprint = await extractReferenceStyle({
      referenceVideoPath: opts.referencePath,
      workDir,
      signal: hooks?.signal,
      onLog: hooks?.onLog,
    });
  }

  // Análise visual multimodal com Gemini (Agentic Video Understanding) se habilitada
  if (opts.enableVisualAnalysis !== false && existsSync(sourcePath) && process.env.GEMINI_API_KEY) {
    try {
      await hooks?.checkCanceled?.();
      await hooks?.onLog?.("Iniciando análise visual com Gemini (Agentic Video Understanding)...");
      const highlights = await analyzeVideoVisuals({
        videoPath: sourcePath,
        workDir,
        language: opts.language,
        signal: hooks?.signal,
        onLog: hooks?.onLog ? (msg) => hooks.onLog?.(msg) : undefined,
      });

      if (highlights.length > 0) {
        opts.visualHighlights = highlights;
        await hooks?.onLog?.(
          `[GEMINI VISION] ${highlights.length} momentos visuais de alto impacto detectados e sincronizados com a fala.`
        );
      }
    } catch (err: any) {
      console.error("Falha na análise visual do Gemini:", err);
      await hooks?.onLog?.(
        `[AVISO] Análise visual ignorada (${err?.message || "erro"}). Prosseguindo com curadoria editorial pela transcrição.`
      );
    }
  }

  const thinkingNotice = opts.enableExtendedThinking !== false ? " com Extended Thinking" : "";
  await hooks?.onLog?.(`Enviando dados para IA (Claude Sonnet${thinkingNotice}) analisar melhores ganchos e retenção viral...`);
  console.log("Claude analisando a transcrição…");
  
  await hooks?.checkCanceled?.();
  const candidates = await findCandidates(
    blocks,
    opts,
    hooks?.onLog ? (msg) => hooks.onLog?.(msg) : undefined
  );
  await hooks?.checkCanceled?.();

  const clips = selectClips(candidates, blocks, opts);
  await hooks?.onLog?.(`IA encontrou ${candidates.length} trechos candidatos. ${clips.length} clipes foram aprovados após validação.`);
  console.log(`  ${candidates.length} candidatos, ${clips.length} aprovados.`);

  if (!clips.length) {
    if (blocks.length > 0) {
      await hooks?.onLog?.("Adaptando corte para a duração total da fala disponível.");
      const a = blocks[0];
      const b = blocks[blocks.length - 1];
      clips.push({
        title: "Destaque do Vídeo",
        hook: a.text.slice(0, 80),
        score: 75,
        reason: "Trecho principal selecionado automaticamente.",
        start: a.start,
        end: b.end,
      });
    } else {
      throw new Error("Nenhum trecho passou na validação. Tente durações diferentes (--min/--max) ou ajuste o prompt.");
    }
  }
  await writeFile(path.join(workDir, "clips.json"), JSON.stringify(clips, null, 2));

  console.log("\nTrechos escolhidos:");
  for (const [i, c] of clips.entries()) {
    const info = `  ${String(i + 1).padStart(2, "0")}. [${fmt(c.start)}–${fmt(c.end)}] (Nota ${c.score}) "${c.title}"`;
    await hooks?.onLog?.(info);
    console.log(info);
    console.log(`      gancho: ${c.hook}`);
  }

  if (opts.dryRun) {
    await hooks?.onLog?.("--dry-run: pulando etapa de renderização de cortes. Veja clips.json.");
    console.log("\n--dry-run: pulando os cortes. Veja clips.json.");
    return { clips, files: [], editDecisions: [] };
  }

  // Cortes
  await hooks?.onLog?.(`Iniciando corte e renderização de ${clips.length} clipes com FFmpeg...`);
  console.log("\nCortando os clipes…");
  const files: string[] = [];
  const editDecisions: import("./types.js").ClipEditDecisions[] = [];
  for (const [i, c] of clips.entries()) {
    await hooks?.checkCanceled?.();
    const progressVal = Math.round(60 + (i / clips.length) * 35);
    await hooks?.onStage?.("cutting", progressVal);
    const file = path.join(workDir, `clip-${String(i + 1).padStart(2, "0")}-${slug(c.title)}.mp4`);
    
    await hooks?.onLog?.(`[Render ${i + 1}/${clips.length}] Cortando [${fmt(c.start)} - ${fmt(c.end)}] -> ${path.basename(file)}`);
    console.log(`  ${path.basename(file)}`);

    // Busca e baixa B-rolls (Higgsfield AI ou Pexels) se solicitado
    const activeBrolls: ActiveBroll[] = [];
    if (opts.useBroll && c.brolls?.length) {
      const hasHiggsKey = Boolean(process.env.HIGGSFIELD_API_KEY?.trim());
      const isAuto = opts.brollSource === "auto";

      if (opts.brollSource === "higgsfield" || (isAuto && hasHiggsKey)) {
        // Gera 1 B-Roll de impacto com IA generativa por clipe
        const topBroll = c.brolls[0];
        await hooks?.checkCanceled?.();
        const brollFile = path.join(workDir, `broll-higgs-c${i + 1}.mp4`);
        await hooks?.onLog?.(`[B-ROLL IA] Gerando B-Roll exclusivo via Higgsfield para o clipe ${i + 1}...`);
        
        const downloaded = await fetchHiggsfieldBroll({
          keyword: topBroll.keyword,
          styleModifier: opts.styleBlueprint?.higgsfieldPromptModifier,
          outPath: brollFile,
          orientation: opts.orientation === "vertical" ? "portrait" : "landscape",
          durationSec: topBroll.durationSec || 3,
          signal: hooks?.signal,
          onLog: hooks?.onLog,
        });

        if (downloaded) {
          activeBrolls.push({
            offsetSec: topBroll.offsetSec,
            durationSec: topBroll.durationSec || 3,
            filePath: downloaded,
          });
        } else {
          // Fallback gracioso para banco de vídeos caso o Higgsfield esteja sem créditos ou indisponível
          await hooks?.onLog?.(`[B-ROLL] Higgsfield indisponível. Tentando fallback automático para banco de vídeos (Pixabay)...`);
          const fallbackFile = path.join(workDir, `broll-stock-fallback-c${i + 1}.mp4`);
          const pexelsDownloaded = await fetchStockBroll({
            query: topBroll.keyword,
            outPath: fallbackFile,
            orientation: opts.orientation === "vertical" ? "portrait" : "landscape",
            signal: hooks?.signal,
            onLog: hooks?.onLog,
          });
          if (pexelsDownloaded) {
            activeBrolls.push({
              offsetSec: topBroll.offsetSec,
              durationSec: topBroll.durationSec || 3,
              filePath: pexelsDownloaded,
            });
          }
        }
      } else {
        if (isAuto && !hasHiggsKey) {
          await hooks?.onLog?.(`[B-ROLL AUTO] Selecionando filmagens contextuais de alta retenção no banco de vídeos (Pixabay)...`);
        }
        for (const [bIdx, broll] of c.brolls.entries()) {
          await hooks?.checkCanceled?.();
          const brollFile = path.join(workDir, `broll-c${i + 1}-${bIdx + 1}.mp4`);
          const downloaded = await fetchStockBroll({
            query: broll.keyword,
            outPath: brollFile,
            orientation: opts.orientation === "vertical" ? "portrait" : "landscape",
            signal: hooks?.signal,
            onLog: hooks?.onLog,
          });
          if (downloaded) {
            activeBrolls.push({
              offsetSec: broll.offsetSec,
              durationSec: broll.durationSec,
              filePath: downloaded,
            });
          }
        }
      }
    }
    
    // Gera legendas dinâmicas animadas palavra por palavra (se ativado ou padrão para vertical)
    let subFile: string | undefined = undefined;
    const shouldAddSubs = opts.subtitles !== false && opts.orientation === "vertical";
    if (shouldAddSubs && words?.length) {
      const assPath = path.join(workDir, `subs-c${i + 1}.ass`);
      const generated = await generateViralAssSubtitles({
        words,
        clipStart: c.start,
        clipEnd: c.end,
        outPath: assPath,
        opts: {
          style: opts.subtitleStyle ?? "hormozi",
          highlightColor: opts.highlightColor,
          fontName: opts.customFontName ?? undefined,
          enableEmojis: opts.enableEmojis !== false,
        },
      });
      if (generated) {
        subFile = generated;
      }
    }

    const dynamicPacing = opts.dynamicZoom !== false 
      ? (opts.styleBlueprint?.averageCutDurationSec || (opts.referenceStyle ? 2.8 : undefined))
      : undefined;

    const shouldColorGrade = opts.colorGrade !== false && Boolean(opts.styleBlueprint || opts.referenceStyle);

    // Constrói eventos de Sound Design (SFX) para o corte
    const sfxEvents: SfxEvent[] = [];
    const clipDuration = c.end - c.start;
    if (opts.enableSfx !== false) {
      // 1. Gancho inicial: Ding sutil aos 0.35s para prender atenção
      sfxEvents.push({ timeSec: 0.35, type: "ding", volume: 0.30 });

      // 2. Transições de B-Roll: Whoosh na entrada de cada overlay
      for (const b of activeBrolls) {
        if (b.offsetSec > 0.5 && b.offsetSec < clipDuration - 0.5) {
          sfxEvents.push({ timeSec: Math.max(0, b.offsetSec - 0.05), type: "whoosh", volume: 0.35 });
        }
      }

      // 3. Zoom / Ritmo dinâmico: Whoosh sutil nos pontos de alternância de câmera
      if (dynamicPacing && dynamicPacing > 0) {
        for (let t = dynamicPacing; t < clipDuration - 1; t += dynamicPacing * 2) {
          // Apenas se não colidir com um B-roll
          const nearBroll = activeBrolls.some((b) => Math.abs(b.offsetSec - t) < 0.8);
          if (!nearBroll) {
            sfxEvents.push({ timeSec: t, type: "whoosh", volume: 0.22 });
          }
        }
      }
    }

    const cutRes = await cutClip({
      input: sourcePath,
      output: file,
      start: c.start,
      end: c.end,
      orientation: opts.orientation,
      verticalMode: opts.verticalMode,
      cropX: opts.cropX,
      brolls: activeBrolls,
      subtitlesPath: subFile,
      fontsDir: opts.fontsDir ?? undefined,
      dynamicPacingSec: dynamicPacing,
      colorGrade: shouldColorGrade,
      sfxEvents,
      signal: hooks?.signal,
      onLog: hooks?.onLog,
    });
    files.push(file);

    // Palavras que caem dentro deste corte
    const clipWords = (words || [])
      .filter((w) => w.end >= c.start && w.start <= c.end)
      .map((w) => ({ w: w.punctuated_word || w.word, s: w.start, e: w.end }));

    editDecisions.push({
      version: 1,
      renderStart: c.start,
      orientation: opts.orientation,
      verticalMode: opts.verticalMode,
      reframe: opts.orientation === "vertical"
        ? {
            centerX: cutRes.cropX,
            keyframes: cutRes.cropKeyframes?.map((k) => ({ t: k.t, x: k.x })),
          }
        : null,
      splitCenters: cutRes.splitCenters ?? null,
      zoomPacingSec: cutRes.zoomPacingSec ?? null,
      colorGrade: shouldColorGrade,
      brolls: activeBrolls.map((b) => ({
        offsetSec: b.offsetSec,
        durationSec: b.durationSec,
        keyword: c.brolls?.find((item) => Math.abs(item.offsetSec - b.offsetSec) < 0.1)?.keyword || "b-roll",
        fileName: path.basename(b.filePath),
        localPath: b.filePath,
      })),
      sfx: sfxEvents.map((s) => ({
        timeSec: s.timeSec,
        type: s.type,
        volume: s.volume ?? 0.35,
      })),
      words: clipWords,
    });
  }
  return { clips, files, editDecisions };
}
