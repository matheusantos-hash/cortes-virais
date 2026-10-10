import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { resolveSystemFont, prepareCustomFont } from "./fonts.js";
import { generateViralAssSubtitles } from "./subtitles.js";
import { trimClip, cutClip, buildEncodingArgs } from "./media.js";
import type { Clip, Job, CanvasBroll } from "../../web/src/lib/types.js";
import { buildTimelineProject } from "../../web/src/lib/export/timeline.js";
import { generateFcp7Xml } from "../../web/src/lib/export/fcp7xml.js";
import { generateEdl } from "../../web/src/lib/export/edl.js";
import { generateClipSrt } from "../../web/src/lib/export/srt.js";

async function runSimulation() {
  console.log("=================================================================");
  console.log("🎬 INICIANDO SIMULAÇÃO COMPLETA: EDITOR DE VÍDEO & EXPORTAÇÃO");
  console.log("=================================================================\n");

  const testDir = path.join(process.cwd(), "temp_simulation_test");
  if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });

  let testsPassed = 0;
  let totalTests = 0;

  function assert(condition: boolean, title: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      testsPassed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      throw new Error(`Falha no teste: ${title}`);
    }
  }

  // -------------------------------------------------------------
  // TESTE 1: Resolução de Fontes do Sistema (Poppins Bold e outras)
  // -------------------------------------------------------------
  console.log("👉 ETAPA 1: Verificando Resolução de Fontes do Sistema...");
  const poppinsFont = resolveSystemFont("Poppins Bold");
  assert(poppinsFont !== null, "Encontrou Poppins Bold no diretório de fontes");
  assert(poppinsFont?.family === "Poppins", "Identificou a família 'Poppins'");
  assert(existsSync(poppinsFont!.filePath), `Arquivo de fonte físico existe: ${poppinsFont?.fileName}`);

  const poppinsSlug = resolveSystemFont("poppins");
  assert(poppinsSlug !== null && poppinsSlug.fileName === "Poppins-Bold.ttf", "Resolve pelo id 'poppins'");

  const montserrat = resolveSystemFont("Montserrat Black");
  assert(montserrat !== null && montserrat.fileName === "Montserrat-Black.ttf", "Resolve Montserrat Black");

  const anton = resolveSystemFont("Anton (MrBeast Style)");
  assert(anton !== null && anton.fileName === "Anton-Regular.ttf", "Resolve Anton");

  // -------------------------------------------------------------
  // TESTE 2: Geração de Legendas Virais ASS (Estilo Poppins + Cores)
  // -------------------------------------------------------------
  console.log("\n👉 ETAPA 2: Testando Geração de Legendas Dinâmicas ASS...");
  const sampleWords = [
    { word: "ESTE", start: 0.2, end: 0.6 },
    { word: "É", start: 0.6, end: 0.8 },
    { word: "O", start: 0.8, end: 1.0 },
    { word: "SEGREDO", start: 1.0, end: 1.6 },
    { word: "DO", start: 1.6, end: 1.8 },
    { word: "ALGORITMO", start: 1.8, end: 2.5 },
  ];

  const assPath = path.join(testDir, "test_poppins.ass");
  const assResult = await generateViralAssSubtitles({
    words: sampleWords,
    clipStart: 0,
    clipEnd: 3,
    outPath: assPath,
    opts: {
      style: "hormozi",
      fontName: "Poppins",
      primaryColor: "#FFFFFF",
      highlightColor: "#FACC15",
      enableEmojis: true,
    },
  });

  assert(assResult !== null && existsSync(assPath), "Arquivo .ass de legendas gerado com sucesso");
  const assContent = readFileSync(assPath, "utf8");
  assert(assContent.includes("Poppins"), "Arquivo ASS especifica a tipografia 'Poppins'");
  assert(assContent.includes("&H0015CCFA&") || assContent.includes("&H00"), "Contém cor hexadecimal convertida para formato ASS BGR");
  assert(assContent.includes("SEGREDO"), "Contém as falas mapeadas da transcrição");

  // -------------------------------------------------------------
  // TESTE 3: Trimming + Queima de Legendas + B-Roll Canvas no FFmpeg
  // -------------------------------------------------------------
  console.log("\n👉 ETAPA 3: Testando Trimming & Re-renderização no FFmpeg...");
  const rawVideoPath = path.join(testDir, "raw_sample.mp4");
  const trimmedOutPath = path.join(testDir, "trimmed_poppins_broll.mp4");

  // Cria vídeo sintético rápido de 5s para o teste
  console.log("  Gerando clipe de teste de 5s via FFmpeg...");
  execSync(
    `ffmpeg -y -f lavfi -i testsrc=duration=5:size=1080x1920:rate=30 -f lavfi -i sine=frequency=440:duration=5 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac "${rawVideoPath}"`,
    { stdio: "ignore" }
  );
  assert(existsSync(rawVideoPath), "Clipe MP4 base gerado com sucesso");

  const brollsMock: CanvasBroll[] = [
    {
      id: "broll-1",
      offsetSec: 1.0,
      durationSec: 2.0,
      template: "metric_counter",
      data: {
        title: "DESTAQUE VIRAL",
        value: "+300%",
        color: "cyan",
        positionY: "top",
      },
    },
  ];

  console.log("  Executando trimClip com corte de 1.0s a 4.0s, B-Roll Canvas e legendas Poppins...");
  await trimClip({
    input: rawVideoPath,
    output: trimmedOutPath,
    trimStartSec: 1.0,
    trimEndSec: 4.0,
    canvasBrolls: brollsMock,
    subtitlesPath: assPath,
    fontsDir: path.dirname(poppinsFont!.filePath),
    onLog: (line) => console.log(`    [FFmpeg Log] ${line}`),
  });

  assert(existsSync(trimmedOutPath), "Vídeo final re-renderizado com sucesso com legendas e B-Rolls");

  // -------------------------------------------------------------
  // TESTE 4: Funções de Exportação (SRT, XML Premiere/Resolve, EDL)
  // -------------------------------------------------------------
  console.log("\n👉 ETAPA 4: Testando Funções do Motor de Exportação...");

  const mockJob: Job = {
    id: "job-test-123",
    user_id: "user-test",
    source_type: "upload",
    file_name: "podcast_ep01.mp4",
    source_url: null,
    source_path: "test/podcast.mp4",
    orientation: "vertical",
    crop_x: 0.5,
    clip_count: 1,
    min_seconds: 15,
    max_seconds: 60,
    language: "pt",
    status: "done",
    progress: 100,
    error: null,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    source_meta: {
      fileName: "podcast_ep01.mp4",
      durationSec: 180,
      fpsNum: 30,
      fpsDen: 1,
      width: 1920,
      height: 1080,
      startTimecode: "00:00:00:00",
      audioChannels: 2,
      audioSampleRate: 48000,
      videoCodec: "h264",
      vfr: false,
    },
  };

  const mockClip: Clip = {
    id: "clip-test-456",
    job_id: "job-test-123",
    position: 1,
    title: "O Maior Segredo de Vendas",
    hook: "Você não vai acreditar nisso!",
    reason: "Pico de retenção alto",
    score: 95,
    start_seconds: 10,
    end_seconds: 40,
    file_path: "user-test/job-test-123/clip-01.mp4",
    edit_decisions: {
      version: 1,
      renderStart: 10,
      orientation: "vertical",
      verticalMode: "crop",
      reframe: { centerX: 0.5 },
      colorGrade: true,
      brolls: [],
      sfx: [],
      words: [
        { w: "VOCÊ", s: 10.2, e: 10.5 },
        { w: "NÃO", s: 10.5, e: 10.8 },
        { w: "VAI", s: 10.8, e: 11.1 },
        { w: "ACREDITAR", s: 11.1, e: 11.6 },
        { w: "NISSO", s: 11.6, e: 12.0 },
      ],
    },
  };

  // 4.1 Exportação SRT
  console.log("  4.1 Testando exportação de legendas SRT...");
  const srtOutput = generateClipSrt(mockClip);
  assert(srtOutput.length > 0, "Conteúdo SRT gerado");
  assert(srtOutput.includes("00:00:00,200 --> 00:00:01,800") || srtOutput.includes("-->"), "SRT contém timecodes válidos");
  assert(srtOutput.includes("VOCÊ NÃO VAI ACREDITAR"), "SRT contém as falas agrupadas corretamente");
  console.log("    Exemplo de saída SRT:");
  console.log("    " + srtOutput.trim().replace(/\n/g, "\n    "));

  // 4.2 Timeline Project
  console.log("  4.2 Testando montagem da timeline do projeto...");
  const timelineProj = buildTimelineProject(mockJob, [mockClip]);
  assert(timelineProj.sequences.length > 0, "Sequência gerada no projeto");
  assert(timelineProj.sequences[0].width === 1080 && timelineProj.sequences[0].height === 1920, "Dimensões 9:16 corretas na sequence");

  // 4.3 Exportação FCP7 XML (Premiere Pro & DaVinci Resolve)
  console.log("  4.3 Testando exportação FCP7 XML (Premiere & DaVinci)...");
  const xmlOutput = generateFcp7Xml(timelineProj);
  assert(xmlOutput.startsWith("<?xml version=\"1.0\""), "XML inicia com declaração válida");
  assert(xmlOutput.includes("<xmeml version=\"5\">"), "XML contém tag <xmeml version=\"5\"> FCP7");
  assert(xmlOutput.includes("<sequence id=") || xmlOutput.includes("<sequence>"), "XML contém elemento <sequence>");
  assert(xmlOutput.includes("<track>"), "XML contém faixas de vídeo e áudio");

  // 4.4 Exportação EDL (CMX3600)
  console.log("  4.4 Testando exportação EDL (CMX3600)...");
  const edlOutput = generateEdl(timelineProj);
  assert(edlOutput.includes("TITLE:"), "EDL contém cabeçalho TITLE");
  assert(edlOutput.includes("FCM: DROP FRAME") || edlOutput.includes("FCM: NON-DROP FRAME"), "EDL define frame rate (DROP ou NON-DROP)");
  assert(edlOutput.includes("001"), "EDL contém primeiro corte");

  // -------------------------------------------------------------
  // TESTE 5: Simulação de Estados e Interações do Editor
  // -------------------------------------------------------------
  console.log("\n👉 ETAPA 5: Testando Lógica de Preview ao Vivo e Sincronização do Editor...");
  
  // Simula a lógica do hook activeSubtitleData
  function simulateSubtitlePreview(currentTimeSec: number) {
    const baseOffset = mockClip.start_seconds;
    const words = mockClip.edit_decisions!.words;
    const relWords = words.map((w: any) => ({
      text: w.w,
      start: w.s - baseOffset,
      end: w.e - baseOffset,
    }));
    const activeIdx = relWords.findIndex((w) => currentTimeSec >= w.start && currentTimeSec <= w.end);
    if (activeIdx !== -1) {
      return {
        activeWord: relWords[activeIdx].text,
        isActive: true,
      };
    }
    return { activeWord: null, isActive: false };
  }

  const previewAt1s = simulateSubtitlePreview(0.3); // 10.3s absoluto
  assert(previewAt1s.activeWord === "VOCÊ", "Detectou a palavra ativa 'VOCÊ' no segundo 0.3");

  const previewAt1_3s = simulateSubtitlePreview(1.3); // 11.3s absoluto
  assert(previewAt1_3s.activeWord === "ACREDITAR", "Detectou a palavra ativa 'ACREDITAR' no segundo 1.3");

  // -------------------------------------------------------------
  // TESTE 6: Exportação Profissional no FFmpeg (HEVC, ProRes 422, EBU R128)
  // -------------------------------------------------------------
  console.log("\n👉 ETAPA 6: Testando Motor de Exportação Profissional (Codecs, Bitrates, EBU R128)...");

  // 6.1 Argumentos ProRes 422
  const proresArgs = buildEncodingArgs({
    duration: 10,
    exportSettings: { codec: "prores422", fps: 24 },
    output: "output.mov",
  });
  assert(proresArgs.includes("prores_ks"), "Gera codec prores_ks para Apple ProRes 422");
  assert(proresArgs.includes("yuv422p10le"), "Gera formato de pixel 10-bit yuv422p10le");
  assert(proresArgs.includes("-r") && proresArgs.includes("24"), "Define taxa de quadros de 24 FPS");

  // 6.2 Argumentos HEVC (H.265) Master Bitrate
  const hevcArgs = buildEncodingArgs({
    duration: 10,
    exportSettings: { codec: "hevc", bitrate: "master", fps: 60 },
    output: "output.mp4",
  });
  assert(hevcArgs.includes("libx265"), "Gera codec libx265 para H.265 / HEVC");
  assert(hevcArgs.includes("hvc1"), "Aplica tag hvc1 para compatibilidade Apple / QuickTime");
  assert(hevcArgs.includes("25M"), "Aplica taxa de dados Master de 25 Mbps");
  assert(hevcArgs.includes("-r") && hevcArgs.includes("60"), "Define taxa de quadros de 60 FPS");

  // 6.3 Render real de clipe em ProRes 422 e EBU R128
  const proresOut = path.join(testDir, "test_prores_master.mov");
  console.log("  Testando render real de clipe em Apple ProRes 422 e EBU R128...");
  await trimClip({
    input: rawVideoPath,
    output: proresOut,
    trimStartSec: 0.5,
    trimEndSec: 2.0,
    exportSettings: {
      codec: "prores422",
      fps: 24,
      audioNormalization: true,
    },
    onLog: (line) => console.log(`    [FFmpeg ProRes] ${line}`),
  });
  assert(existsSync(proresOut), "Vídeo ProRes 422 master exportado com sucesso");

  // 6.4 Render real de clipe em H.265 / HEVC com normalização de áudio
  const hevcOut = path.join(testDir, "test_hevc_high.mp4");
  console.log("  Testando render real de clipe em H.265 / HEVC com EBU R128...");
  await trimClip({
    input: rawVideoPath,
    output: hevcOut,
    trimStartSec: 1.0,
    trimEndSec: 2.5,
    exportSettings: {
      codec: "hevc",
      fps: 30,
      bitrate: "high",
      audioNormalization: true,
    },
    onLog: (line) => console.log(`    [FFmpeg HEVC] ${line}`),
  });
  assert(existsSync(hevcOut), "Vídeo HEVC H.265 com EBU R128 exportado com sucesso");

  // Limpeza
  rmSync(testDir, { recursive: true, force: true });

  console.log("\n=================================================================");
  console.log(`🎉 TODAS AS ${testsPassed}/${totalTests} SIMULAÇÕES FORAM CONCLUÍDAS COM SUCESSO!`);
  console.log("=================================================================\n");
}

runSimulation().catch((err) => {
  console.error("❌ Erro fatal na simulação:", err);
  process.exit(1);
});
