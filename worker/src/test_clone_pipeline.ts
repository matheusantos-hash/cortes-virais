import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { downloadVideo } from "./media.js";
import { processVideo } from "./pipeline.js";
import { extractReferenceStyle } from "./ref_analyzer.js";
import type { Options } from "./types.js";

async function runTest() {
  console.log("==========================================================");
  console.log("🚀 INICIANDO TESTE REAL DE CLONAGEM DE ESTILO DE VÍDEO");
  console.log("==========================================================");

  const testDir = path.resolve("output", "real_test");
  await mkdir(testDir, { recursive: true });

  // 1. URLs REAIS DA INTERNET
  const referenceUrl = "https://www.youtube.com/watch?v=nw_NabUj8ck"; // Vídeo curto com edição dinâmica
  const targetUrl = "https://www.youtube.com/watch?v=lcG2mvXRzeo";    // Vídeo com fala reflexiva/motivacional (3m50s)

  const refPath = path.join(testDir, "reference.mp4");
  const targetPath = path.join(testDir, "source.mp4");

  // Download do vídeo de referência se não existir
  if (!existsSync(refPath)) {
    console.log("\n📥 [1/4] Baixando VÍDEO DE REFERÊNCIA (Modelo de Estilo):", referenceUrl);
    await downloadVideo(referenceUrl, refPath, undefined, (msg) => console.log(`   [yt-dlp ref] ${msg}`));
    console.log("✅ Vídeo de referência baixado:", refPath);
  } else {
    console.log("\n✅ [1/4] Vídeo de referência já existe em disco:", refPath);
  }

  // Download do vídeo principal se não existir
  if (!existsSync(targetPath)) {
    console.log("\n📥 [2/4] Baixando VÍDEO PRINCIPAL (Receberá a Edição):", targetUrl);
    await downloadVideo(targetUrl, targetPath, undefined, (msg) => console.log(`   [yt-dlp target] ${msg}`));
    console.log("✅ Vídeo principal baixado:", targetPath);
  } else {
    console.log("\n✅ [2/4] Vídeo principal já existe em disco:", targetPath);
  }

  // 2. Extração de Estilo do Vídeo de Referência
  console.log("\n🎨 [3/4] Extraindo Estilo de Edição da Referência (FFmpeg + Claude Vision)...");
  const blueprint = await extractReferenceStyle({
    referenceVideoPath: refPath,
    workDir: testDir,
    onLog: (msg) => console.log(`   ${msg}`),
  });

  console.log("\n📋 --- BLUEPRINT DE ESTILO EXTRAÍDO PELA IA ---");
  console.log(JSON.stringify(blueprint, null, 2));
  console.log("------------------------------------------------\n");

  // 3. Processamento do Vídeo Principal aplicando o Estilo
  console.log("✂️ [4/4] Processando e Gerando Cortes aplicando o Estilo Clonado...");
  const opts: Options = {
    orientation: "vertical",
    clips: 1, // 1 corte selecionado e renderizado para velocidade do teste
    minSeconds: 15,
    maxSeconds: 65,
    language: "pt-BR",
    verticalMode: "crop",
    cropX: 0.5,
    referencePath: refPath,
    styleBlueprint: blueprint,
    useBroll: false,
    force: false,
    dryRun: false,
  };

  const result = await processVideo({
    sourcePath: targetPath,
    workDir: testDir,
    opts,
    hooks: {
      onStage: (stage, progress) => {
        console.log(`   [ESTÁGIO: ${stage.toUpperCase()}] Progresso: ${progress}%`);
      },
      onLog: (msg) => {
        console.log(`   [LOG] ${msg}`);
      },
    },
  });

  console.log("\n==========================================================");
  console.log("🎉 TESTE CONCLUÍDO COM SUCESSO!");
  console.log("==========================================================");
  console.log(`Cortes gerados: ${result.clips.length}`);
  for (const c of result.clips) {
    console.log(`- Título: "${c.title}"`);
    console.log(`- Gancho: "${c.hook}"`);
    console.log(`- Duração: ${c.start}s até ${c.end}s (Nota Viral: ${c.score}/100)`);
    console.log(`- Motivo: ${c.reason}`);
  }
  console.log("\nArquivos de vídeo gerados:");
  for (const f of result.files) {
    console.log(`📁 ${f}`);
  }
}

runTest().catch((err) => {
  console.error("\n❌ ERRO NO TESTE:", err);
  process.exit(1);
});
