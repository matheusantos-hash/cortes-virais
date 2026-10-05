import type { Job, Clip, SourceMeta, ClipEditDecisions } from "@/lib/types";
import { secondsToFrames, timecodeToFrames, type FpsFraction } from "./timecode";

export interface MediaAsset {
  id: string;
  name: string;
  type: "video" | "audio";
  width?: number;
  height?: number;
  durationFrames: number;
  fps: FpsFraction;
  pathUrl?: string;
  reelName: string;
}

export interface Marker {
  frame: number;
  name: string;
  comment: string;
  color: "cyan" | "green" | "yellow" | "red" | "magenta";
}

export interface TransformKeyframe {
  frame: number; // relativo ao início do item na sequence
  centerX: number; // -100 a +100
  centerY: number;
}

export interface TrackItem {
  id: string;
  mediaAssetId: string;
  name: string;
  startFrame: number;   // Ponto na timeline da sequência
  endFrame: number;
  inFrame: number;      // Ponto de entrada na mídia original
  outFrame: number;     // Ponto de saída na mídia original
  scale?: number;       // Escala base (ex.: 316.22% para encaixar 16:9 em 9:16)
  centerX?: number;     // -100 a +100
  centerY?: number;     // -100 a +100
  keyframes?: TransformKeyframe[];
}

export interface Sequence {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: FpsFraction;
  durationFrames: number;
  startTimecode: string;
  v1Tracks: TrackItem[]; // Vídeo principal (orador)
  v2Tracks: TrackItem[]; // B-rolls
  a1Tracks: TrackItem[]; // Áudio original
  a2Tracks: TrackItem[]; // SFX / sound design
  markers: Marker[];
}

export interface TimelineProject {
  projectName: string;
  mediaAssets: MediaAsset[];
  sequences: Sequence[];
}

export function buildTimelineProject(job: Job, clips: Clip[]): TimelineProject {
  const meta: SourceMeta = job.source_meta ?? {
    fileName: job.file_name || "source.mp4",
    durationSec: 600,
    fpsNum: 30,
    fpsDen: 1,
    width: 1920,
    height: 1080,
    startTimecode: "00:00:00:00",
    audioChannels: 2,
    audioSampleRate: 48000,
    videoCodec: "h264",
    vfr: false,
  };

  const fps: FpsFraction = { num: meta.fpsNum || 30, den: meta.fpsDen || 1 };
  const sourceDurationFrames = secondsToFrames(meta.durationSec || 600, fps);
  const sourceBaseInFrames = meta.startTimecode ? timecodeToFrames(meta.startTimecode, fps) : 0;

  const originalSourceAsset: MediaAsset = {
    id: "media_source_main",
    name: meta.fileName || "source.mp4",
    type: "video",
    width: meta.width,
    height: meta.height,
    durationFrames: sourceDurationFrames,
    fps,
    reelName: "REEL01",
    pathUrl: meta.fileName || "source.mp4",
  };

  const mediaAssetsMap = new Map<string, MediaAsset>();
  mediaAssetsMap.set(originalSourceAsset.id, originalSourceAsset);

  const sequences: Sequence[] = [];

  const targetWidth = job.orientation === "vertical" ? 1080 : 1920;
  const targetHeight = job.orientation === "vertical" ? 1920 : 1080;

  // Escala para preencher 9:16 (1080x1920) a partir de 16:9 (1920x1080)
  // FCP7 usa escala 100% como tamanho nativo. Para preencher altura (1920/1080):
  const fillScale = job.orientation === "vertical" ? (targetHeight / meta.height) * 100 : 100;

  clips.forEach((clip, cIdx) => {
    const decisions: ClipEditDecisions | undefined = clip.edit_decisions ?? undefined;
    const startSec = Number(clip.start_seconds);
    const endSec = Number(clip.end_seconds);
    const durationSec = Math.max(1, endSec - startSec);

    const clipDurationFrames = secondsToFrames(durationSec, fps);
    const inFrame = sourceBaseInFrames + secondsToFrames(startSec, fps);
    const outFrame = inFrame + clipDurationFrames;

    // Converte cropX (0 a 1) para o espaço de coordenadas de Basic Motion (-100 a +100)
    // 0 = extrema esquerda (+100 no XML), 0.5 = centro (0), 1 = extrema direita (-100 no XML)
    const effectiveCropX = decisions?.reframe?.centerX ?? (typeof job.crop_x === "number" ? job.crop_x : 0.5);
    const motionCenterX = -((effectiveCropX - 0.5) * 200);

    const v1Item: TrackItem = {
      id: `v1_clip_${clip.id}`,
      mediaAssetId: originalSourceAsset.id,
      name: `${clip.title} (Orador)`,
      startFrame: 0,
      endFrame: clipDurationFrames,
      inFrame,
      outFrame,
      scale: fillScale,
      centerX: motionCenterX,
      centerY: 0,
    };

    // Keyframes de enquadramento facial dinâmico (se houver)
    if (decisions?.reframe?.keyframes && decisions.reframe.keyframes.length > 0) {
      v1Item.keyframes = decisions.reframe.keyframes.map((kf) => ({
        frame: secondsToFrames(kf.t, fps),
        centerX: -((kf.x - 0.5) * 200),
        centerY: 0,
      }));
    }

    const a1Item: TrackItem = {
      id: `a1_clip_${clip.id}`,
      mediaAssetId: originalSourceAsset.id,
      name: `${clip.title} (Áudio Original)`,
      startFrame: 0,
      endFrame: clipDurationFrames,
      inFrame,
      outFrame,
    };

    const v2Tracks: TrackItem[] = [];
    if (decisions?.brolls) {
      decisions.brolls.forEach((b, bIdx) => {
        const brollAssetId = `media_broll_${clip.position}_${bIdx + 1}`;
        if (!mediaAssetsMap.has(brollAssetId)) {
          mediaAssetsMap.set(brollAssetId, {
            id: brollAssetId,
            name: b.fileName || `broll_${b.keyword}.mp4`,
            type: "video",
            width: targetWidth,
            height: targetHeight,
            durationFrames: secondsToFrames(b.durationSec, fps),
            fps,
            reelName: `BROLL_${bIdx + 1}`,
            pathUrl: b.fileName,
          });
        }

        const bStartFrame = secondsToFrames(b.offsetSec, fps);
        const bDurationFrames = secondsToFrames(b.durationSec, fps);

        v2Tracks.push({
          id: `v2_broll_${clip.id}_${bIdx}`,
          mediaAssetId: brollAssetId,
          name: `B-Roll: ${b.keyword}`,
          startFrame: bStartFrame,
          endFrame: Math.min(clipDurationFrames, bStartFrame + bDurationFrames),
          inFrame: 0,
          outFrame: bDurationFrames,
          scale: 100,
          centerX: 0,
          centerY: 0,
        });
      });
    }

    const a2Tracks: TrackItem[] = [];
    if (decisions?.sfx) {
      decisions.sfx.forEach((s, sIdx) => {
        const sfxAssetId = `sfx_${s.type}`;
        if (!mediaAssetsMap.has(sfxAssetId)) {
          mediaAssetsMap.set(sfxAssetId, {
            id: sfxAssetId,
            name: `${s.type}.wav`,
            type: "audio",
            durationFrames: secondsToFrames(2, fps),
            fps,
            reelName: "SFX",
            pathUrl: `assets/sfx/${s.type}.wav`,
          });
        }

        const sStartFrame = secondsToFrames(s.timeSec, fps);
        const sDurationFrames = secondsToFrames(0.7, fps); // durações médias de whoosh/ding/pop

        a2Tracks.push({
          id: `a2_sfx_${clip.id}_${sIdx}`,
          mediaAssetId: sfxAssetId,
          name: `SFX: ${s.type}`,
          startFrame: sStartFrame,
          endFrame: Math.min(clipDurationFrames, sStartFrame + sDurationFrames),
          inFrame: 0,
          outFrame: sDurationFrames,
        });
      });
    }

    const markers: Marker[] = [];
    if (clip.hook) {
      markers.push({
        frame: 0,
        name: `Gancho: "${clip.hook.slice(0, 30)}..."`,
        comment: `Gancho Viral: ${clip.hook}`,
        color: "yellow",
      });
    }
    if (clip.reason) {
      markers.push({
        frame: Math.min(clipDurationFrames, secondsToFrames(1.5, fps)),
        name: `Score IA: ${clip.score ?? 95}/100`,
        comment: `Motivo IA: ${clip.reason}`,
        color: "cyan",
      });
    }

    sequences.push({
      id: `seq_clip_${clip.id}`,
      name: `${String(clip.position).padStart(2, "0")} - ${clip.title.replace(/[^\w\s-]/g, "")}`,
      width: targetWidth,
      height: targetHeight,
      fps,
      durationFrames: clipDurationFrames,
      startTimecode: "00:00:00:00",
      v1Tracks: [v1Item],
      v2Tracks,
      a1Tracks: [a1Item],
      a2Tracks,
      markers,
    });
  });

  return {
    projectName: `CortesVirais_${job.id.slice(0, 8)}`,
    mediaAssets: Array.from(mediaAssetsMap.values()),
    sequences,
  };
}
