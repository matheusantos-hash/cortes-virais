import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBlocks, findCandidates, selectClips } from "./analyze.js";
import { cutClip, extractAudio } from "./media.js";
import { transcribe } from "./transcribe.js";
import type { Clip, Options, Word } from "./types.js";

export type Stage = "transcribing" | "analyzing" | "cutting";

export interface Hooks {
  /** Chamado ao entrar em cada etapa, com o progresso (0–100) do job. */
  onStage?: (stage: Stage, progress: number) => void | Promise<void>;
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
}): Promise<{ clips: Clip[]; files: string[] }> {
  const { sourcePath, workDir, opts, hooks } = args;

  // Áudio
  const audioPath = path.join(workDir, "audio.mp3");
  if (opts.force || !existsSync(audioPath)) {
    console.log("Extraindo o áudio…");
    await extractAudio(sourcePath, audioPath);
  }

  // Transcrição (em cache no disco, para não pagar de novo ao ajustar o prompt)
  await hooks?.onStage?.("transcribing", 25);
  const transcriptPath = path.join(workDir, "transcript.json");
  let words: Word[];
  if (opts.force || !existsSync(transcriptPath)) {
    console.log("Transcrevendo no Deepgram…");
    words = await transcribe(audioPath, opts.language);
    await writeFile(transcriptPath, JSON.stringify(words));
  } else {
    console.log("Transcrição já existe, reaproveitando.");
    words = JSON.parse(await readFile(transcriptPath, "utf8"));
  }
  const blocks = buildBlocks(words);
  console.log(`  ${words.length} palavras, ${blocks.length} blocos.`);

  // Claude escolhe os trechos
  await hooks?.onStage?.("analyzing", 50);
  console.log("Claude analisando a transcrição…");
  const candidates = await findCandidates(blocks, opts);
  const clips = selectClips(candidates, blocks, opts);
  console.log(`  ${candidates.length} candidatos, ${clips.length} aprovados.`);
  if (!clips.length) {
    throw new Error("Nenhum trecho passou na validação. Tente --min/--max diferentes ou ajuste o prompt.");
  }
  await writeFile(path.join(workDir, "clips.json"), JSON.stringify(clips, null, 2));

  console.log("\nTrechos escolhidos:");
  clips.forEach((c, i) => {
    console.log(`  ${String(i + 1).padStart(2, "0")}. [${fmt(c.start)}–${fmt(c.end)}] (${c.score}) ${c.title}`);
    console.log(`      gancho: ${c.hook}`);
  });

  if (opts.dryRun) {
    console.log("\n--dry-run: pulando os cortes. Veja clips.json.");
    return { clips, files: [] };
  }

  // Cortes
  console.log("\nCortando os clipes…");
  const files: string[] = [];
  for (const [i, c] of clips.entries()) {
    await hooks?.onStage?.("cutting", Math.round(60 + (i / clips.length) * 35));
    const file = path.join(workDir, `clip-${String(i + 1).padStart(2, "0")}-${slug(c.title)}.mp4`);
    console.log(`  ${path.basename(file)}`);
    await cutClip({
      input: sourcePath,
      output: file,
      start: c.start,
      end: c.end,
      orientation: opts.orientation,
      verticalMode: opts.verticalMode,
      cropX: opts.cropX,
    });
    files.push(file);
  }
  return { clips, files };
}
