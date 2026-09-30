import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { downloadVideo, tryDirectDownload } from "./media.js";
import { processVideo, slug } from "./pipeline.js";
import type { Options, Orientation, VerticalMode } from "./types.js";

const USAGE = `Uso:
  npm start -- <arquivo.mp4 | link> [opções]

Opções:
  --orientation vertical|horizontal   (padrão: vertical)
  --clips <n>                         quantidade de clipes (padrão: 10)
  --min <segundos>                    duração mínima (padrão: 30)
  --max <segundos>                    duração máxima (padrão: 90)
  --lang <código>                     idioma (padrão: pt-BR)
  --vertical-mode crop|blur           crop = preenche o quadro 9:16 (padrão)
                                      blur = vídeo inteiro sobre fundo desfocado
  --crop-x <0 a 1>                    posição do corte: 0 esquerda, 0.5 centro, 1 direita (padrão: 0.5)
  --dry-run                           só escolhe os trechos, não corta os vídeos
  --force                             refaz download, áudio e transcrição`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      orientation: { type: "string", default: "vertical" },
      clips: { type: "string", default: "10" },
      min: { type: "string", default: "30" },
      max: { type: "string", default: "90" },
      lang: { type: "string", default: "pt-BR" },
      "vertical-mode": { type: "string", default: "crop" },
      "crop-x": { type: "string", default: "0.5" },
      "dry-run": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
    },
  });

  const input = positionals[0];
  if (!input) {
    console.log(USAGE);
    process.exit(1);
  }

  if (!["vertical", "horizontal"].includes(values.orientation!)) {
    throw new Error('--orientation deve ser "vertical" ou "horizontal"');
  }
  if (!["blur", "crop"].includes(values["vertical-mode"]!)) {
    throw new Error('--vertical-mode deve ser "blur" ou "crop"');
  }

  const cropX = Number(values["crop-x"]);
  if (!Number.isFinite(cropX) || cropX < 0 || cropX > 1) {
    throw new Error("--crop-x precisa ser um número entre 0 e 1");
  }

  const opts: Options = {
    orientation: values.orientation as Orientation,
    clips: Number(values.clips),
    minSeconds: Number(values.min),
    maxSeconds: Number(values.max),
    language: values.lang!,
    verticalMode: values["vertical-mode"] as VerticalMode,
    cropX,
    force: values.force!,
    dryRun: values["dry-run"]!,
  };
  if (![opts.clips, opts.minSeconds, opts.maxSeconds].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("--clips, --min e --max precisam ser números positivos");
  }
  if (opts.minSeconds >= opts.maxSeconds) throw new Error("--min precisa ser menor que --max");

  const isUrl = /^https?:\/\//i.test(input);
  const name = isUrl
    ? "link-" + createHash("sha1").update(input).digest("hex").slice(0, 8)
    : slug(path.parse(input).name) || "video";
  const workDir = path.join("output", name);
  await mkdir(workDir, { recursive: true });
  console.log(`Pasta de trabalho: ${workDir}\n`);

  // Vídeo de origem
  let sourcePath: string;
  if (isUrl) {
    sourcePath = path.join(workDir, "source.mp4");
    if (opts.force || !existsSync(sourcePath)) {
      console.log("Baixando o vídeo…");
      const direct = await tryDirectDownload(input, sourcePath).catch(() => "not-direct" as const);
      if (direct === "too-large") throw new Error("O arquivo desse link é grande demais.");
      if (direct === "not-direct") await downloadVideo(input, sourcePath);
    } else {
      console.log("Vídeo já baixado, reaproveitando.");
    }
  } else {
    sourcePath = path.resolve(input);
    if (!existsSync(sourcePath)) throw new Error(`Arquivo não encontrado: ${sourcePath}`);
    console.log("Usando o arquivo local.");
  }

  await processVideo({ sourcePath, workDir, opts });
  if (!opts.dryRun) console.log(`\nPronto! Clipes em: ${workDir}`);
}

main().catch((err) => {
  console.error("\nErro:", err instanceof Error ? err.message : err);
  process.exit(1);
});
