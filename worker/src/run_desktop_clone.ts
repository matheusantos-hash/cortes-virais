import "dotenv/config";
import { copyFileSync, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { processVideo } from "./pipeline.js";
import { extractReferenceStyle } from "./ref_analyzer.js";
import type { Options } from "./types.js";

async function main() {
  console.log("==========================================================");
  console.log("🎬 CLONAGEM DE ESTILO DE EDIÇÃO: VIDEOBASE -> VIDEO A RECEBER");
  console.log("==========================================================");

  const refPath = "C:\\Users\\Pc\\Desktop\\videobase.mp4";
  const targetPath = "C:\\Users\\Pc\\Desktop\\VIDEO A RECEBER.mp4";
  const finalDest = "C:\\Users\\Pc\\Desktop\\VIDEO_FINAL_EDICAO_CLONADA.mp4";

  if (!existsSync(refPath)) {
    throw new Error(`Vídeo de referência não encontrado em: ${refPath}`);
  }
  if (!existsSync(targetPath)) {
    throw new Error(`Vídeo a receber não encontrado em: ${targetPath}`);
  }

  const workDir = path.resolve("output", "desktop_clone");
  await mkdir(workDir, { recursive: true });

  console.log("\n[1/3] 🔍 Extraindo DNA e Estilo de Edição da Referência (videobase.mp4)...");
  const blueprint = await extractReferenceStyle({
    referenceVideoPath: refPath,
    workDir,
    onLog: (msg) => console.log(`   ${msg}`),
  });

  console.log("\n📋 Blueprint de Estilo Extraído com Sucesso:");
  console.log(JSON.stringify(blueprint, null, 2));

  console.log("\n[2/3] ✂️ Aplicando Edição Clonada no 'VIDEO A RECEBER.mp4'...");
  const opts: Options = {
    orientation: "vertical",
    clips: 1,
    minSeconds: 15,
    maxSeconds: 45,
    language: "pt-BR",
    verticalMode: "crop",
    cropX: 0.5,
    referencePath: refPath,
    styleBlueprint: blueprint,
    useBroll: true,
    brollSource: "auto",
    subtitleStyle: "hormozi",
    enableSfx: true,
    enableEmojis: true,
    dynamicZoom: true,
    colorGrade: true,
    force: true,
    dryRun: false,
  };

  const result = await processVideo({
    sourcePath: targetPath,
    workDir,
    opts,
    hooks: {
      onStage: (stage, progress) => {
        console.log(`   🚀 [${stage.toUpperCase()}] Progresso: ${progress}%`);
      },
      onLog: (msg) => {
        console.log(`   [LOG] ${msg}`);
      },
    },
  });

  if (!result.files.length) {
    throw new Error("Nenhum clipe finalizado foi gerado pelo pipeline.");
  }

  const generatedClip = result.files[0];
  copyFileSync(generatedClip, finalDest);

  console.log("\n==========================================================");
  console.log("🎉 VÍDEO FINAL GERADO COM SUCESSO!");
  console.log("==========================================================");
  console.log(`📁 Arquivo salvo na Área de Trabalho:`);
  console.log(`👉 ${finalDest}`);
  console.log(`\nDetalhes do Corte e Edição:`);
  const c = result.clips[0];
  console.log(`- Título: "${c.title}"`);
  console.log(`- Gancho: "${c.hook}"`);
  console.log(`- Duração: ${c.start.toFixed(1)}s a ${c.end.toFixed(1)}s`);
  console.log(`- Nota Viral: ${c.score}/100`);
}

main().catch((err) => {
  console.error("\n❌ ERRO NA EXECUÇÃO:", err);
  process.exit(1);
});
