import type { Clip, SubtitleStyle } from "@/lib/types";

// Utilitário para gerar UUIDs v4 compatíveis com o parser do CapCut
function generateCapCutId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Converte segundos para microssegundos inteiros (unidade padrão do CapCut: 1s = 1.000.000us)
export function secondsToCapCutUs(seconds: number): number {
  return Math.round(Math.max(0, seconds) * 1_000_000);
}

export interface CapCutDraftPackage {
  draftContentJson: string;
  draftInfoJson: string;
  srtContent: string;
  projectName: string;
  videoFileName: string;
}

/**
 * Agrupa palavras individuais em frases/linhas curtas de legenda de acordo com o ritmo do corte.
 */
function groupWordsIntoSubtitleSegments(
  words: { w: string; s: number; e: number }[],
  clipStartSec: number,
  clipDurationSec: number,
  maxWordsPerSegment = 4
): { text: string; startSec: number; endSec: number }[] {
  if (!words || words.length === 0) return [];

  // Ajusta timings para serem relativos ao início do corte (0.0s)
  const relativeWords = words
    .filter((w) => w.e >= clipStartSec && w.s <= clipStartSec + clipDurationSec)
    .map((w) => ({
      word: w.w.trim(),
      start: Math.max(0, w.s - clipStartSec),
      end: Math.min(clipDurationSec, w.e - clipStartSec),
    }))
    .filter((w) => w.word.length > 0 && w.end > w.start);

  if (relativeWords.length === 0) return [];

  const segments: { text: string; startSec: number; endSec: number }[] = [];
  let currentGroup: typeof relativeWords = [];

  for (let i = 0; i < relativeWords.length; i++) {
    currentGroup.push(relativeWords[i]);

    const isLast = i === relativeWords.length - 1;
    const nextGap = !isLast ? relativeWords[i + 1].start - relativeWords[i].end : 0;

    // Quebra se atingir tamanho máximo de palavras ou pausa significativa na fala (> 0.45s)
    if (currentGroup.length >= maxWordsPerSegment || nextGap > 0.45 || isLast) {
      const text = currentGroup.map((g) => g.word).join(" ");
      const startSec = currentGroup[0].start;
      const endSec = currentGroup[currentGroup.length - 1].end;
      segments.push({ text, startSec, endSec: Math.max(startSec + 0.3, endSec) });
      currentGroup = [];
    }
  }

  return segments;
}

/**
 * Gera os dados de projeto nativo do CapCut Desktop (draft_content.json e draft_info.json)
 * com trilha de vídeo limpo e trilha separada de legendas 100% editáveis no CapCut.
 */
export function generateCapCutDraft(
  clip: Clip,
  options?: {
    cleanVideoFileName?: string;
    subtitleStyle?: SubtitleStyle;
    primaryColorHex?: string;
    highlightColorHex?: string;
    fontName?: string;
  }
): CapCutDraftPackage {
  const durationSec = Math.max(1, Number(clip.end_seconds) - Number(clip.start_seconds));
  const clipDurationUs = secondsToCapCutUs(durationSec);
  const nowUs = Date.now() * 1000;

  const safeTitle = (clip.title || `corte_${clip.position || 1}`)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const projectName = `CapCut_${safeTitle}`;
  const videoFileName = options?.cleanVideoFileName || "video_limpo.mp4";

  // IDs estruturais
  const videoMaterialId = generateCapCutId();
  const speedMaterialId = generateCapCutId();
  const canvasMaterialId = generateCapCutId();
  const videoTrackId = generateCapCutId();
  const textTrackId = generateCapCutId();
  const videoSegmentId = generateCapCutId();

  // Extrai palavras do clipe
  const rawWords = clip.edit_decisions?.words || [];
  const subtitleSegments = groupWordsIntoSubtitleSegments(
    rawWords,
    Number(clip.start_seconds),
    durationSec,
    4
  );

  // Monta materiais de texto e segmentos da trilha de legendas
  const textMaterials: any[] = [];
  const textSegments: any[] = [];

  const fontName = options?.fontName || "Montserrat";
  const primaryColor = options?.primaryColorHex || "#FFFFFF";

  subtitleSegments.forEach((seg, idx) => {
    const textMatId = generateCapCutId();
    const textSegId = generateCapCutId();
    const startUs = secondsToCapCutUs(seg.startSec);
    const segDurationUs = secondsToCapCutUs(seg.endSec - seg.startSec);

    // Conteúdo formatado em JSON conforme padrão de texto do CapCut
    const textJsonContent = JSON.stringify({
      text: seg.text,
      styles: [
        {
          fill: {
            alpha: 1,
            content: {
              render_type: "solid",
              solid: {
                color: [
                  parseInt(primaryColor.slice(1, 3) || "FF", 16) / 255,
                  parseInt(primaryColor.slice(3, 5) || "FF", 16) / 255,
                  parseInt(primaryColor.slice(5, 7) || "FF", 16) / 255,
                ],
              },
            },
          },
          font: {
            id: "",
            path: "",
            name: fontName,
          },
          size: 7.5,
          bold: true,
          align_type: 1, // Centralizado
        },
      ],
    });

    textMaterials.push({
      id: textMatId,
      type: "text",
      content: textJsonContent,
      typesetting: 0,
      font_title: fontName,
      font_path: "",
      font_category: "standard",
      font_size: 7.5,
      text_color: primaryColor,
      text_alpha: 1.0,
      alignment: 1,
      style_name: "Viral Subtitle",
      words: [],
    });

    textSegments.push({
      id: textSegId,
      material_id: textMatId,
      target_timerange: {
        duration: segDurationUs,
        start: startUs,
      },
      source_timerange: null,
      speed: 1.0,
      volume: 1.0,
      render_index: idx + 1,
      clip: null,
    });
  });

  // Monta estrutura principal do draft_content.json do CapCut
  const draftContent = {
    version: 3000000,
    fps: 30.0,
    duration: clipDurationUs,
    canvas_config: {
      width: 1080,
      height: 1920,
      ratio: "original",
    },
    materials: {
      videos: [
        {
          id: videoMaterialId,
          type: "video",
          path: videoFileName,
          duration: clipDurationUs,
          width: 1080,
          height: 1920,
          material_name: videoFileName,
        },
      ],
      canvases: [
        {
          id: canvasMaterialId,
          type: "canvas_color",
          color: "#00000000",
        },
      ],
      speeds: [
        {
          id: speedMaterialId,
          mode: 0,
          speed: 1.0,
          type: "speed",
        },
      ],
      texts: textMaterials,
      audios: [],
      stickers: [],
      effects: [],
    },
    tracks: [
      {
        id: videoTrackId,
        type: "video",
        attribute: 0,
        flag: 0,
        segments: [
          {
            id: videoSegmentId,
            material_id: videoMaterialId,
            target_timerange: {
              duration: clipDurationUs,
              start: 0,
            },
            source_timerange: {
              duration: clipDurationUs,
              start: 0,
            },
            speed: 1.0,
            volume: 1.0,
            render_index: 0,
          },
        ],
      },
      ...(textSegments.length > 0
        ? [
            {
              id: textTrackId,
              type: "text",
              attribute: 0,
              flag: 0,
              segments: textSegments,
            },
          ]
        : []),
    ],
  };

  // Monta metadados do draft_info.json do CapCut
  const draftInfo = {
    draft_id: generateCapCutId(),
    draft_name: projectName,
    draft_fold_path: "",
    draft_root_path: "",
    draft_timeline_materials_size_: 1,
    tm_draft_cloud_completed: "",
    tm_draft_create: nowUs,
    tm_draft_modified: nowUs,
    draft_cover: "",
    draft_removable: true,
  };

  // Gera também o SRT correspondente para máxima flexibilidade
  let srtContent = "";
  subtitleSegments.forEach((seg, i) => {
    const sH = Math.floor(seg.startSec / 3600);
    const sM = Math.floor((seg.startSec % 3600) / 60);
    const sS = Math.floor(seg.startSec % 60);
    const sMs = Math.floor((seg.startSec % 1) * 1000);

    const eH = Math.floor(seg.endSec / 3600);
    const eM = Math.floor((seg.endSec % 3600) / 60);
    const eS = Math.floor(seg.endSec % 60);
    const eMs = Math.floor((seg.endSec % 1) * 1000);

    const sFmt = `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}:${String(sS).padStart(2, "0")},${String(sMs).padStart(3, "0")}`;
    const eFmt = `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}:${String(eS).padStart(2, "0")},${String(eMs).padStart(3, "0")}`;

    srtContent += `${i + 1}\n${sFmt} --> ${eFmt}\n${seg.text}\n\n`;
  });

  return {
    draftContentJson: JSON.stringify(draftContent, null, 2),
    draftInfoJson: JSON.stringify(draftInfo, null, 2),
    srtContent,
    projectName,
    videoFileName,
  };
}
