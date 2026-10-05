import type { TimelineProject } from "./timeline";
import { framesToTimecode, isDropFrame } from "./timecode";

/**
 * Gera um arquivo EDL padrão CMX 3600.
 * O formato CMX 3600 é uma especificação clássica e universal da indústria para conform e relink.
 */
export function generateEdl(project: TimelineProject): string {
  const primarySeq = project.sequences[0];
  if (!primarySeq) return "TITLE: NO SEQUENCE\nFCM: NON-DROP FRAME\n";

  const fps = primarySeq.fps;
  const isDrop = isDropFrame(fps);
  const fcm = isDrop ? "DROP FRAME" : "NON-DROP FRAME";

  let out = `TITLE: ${project.projectName}\nFCM: ${fcm}\n\n`;

  let eventNum = 1;

  for (const seq of project.sequences) {
    for (const item of seq.v1Tracks) {
      const srcInTc = framesToTimecode(item.inFrame, fps);
      const srcOutTc = framesToTimecode(item.outFrame, fps);
      const recInTc = framesToTimecode(item.startFrame, fps);
      const recOutTc = framesToTimecode(item.endFrame, fps);

      const numStr = String(eventNum).padStart(3, "0");
      const reel = "AX      "; // 8 caracteres padrão para reel de câmera / arquivo

      // Linha de evento de vídeo (V)
      out += `${numStr}  ${reel} V     C        ${srcInTc} ${srcOutTc} ${recInTc} ${recOutTc}\n`;
      out += `* FROM CLIP NAME: ${item.name}\n`;

      // Linha de evento de áudio estéreo (AA)
      out += `${numStr}  ${reel} AA    C        ${srcInTc} ${srcOutTc} ${recInTc} ${recOutTc}\n`;
      out += `* FROM CLIP NAME: ${item.name}\n\n`;

      eventNum++;
    }
  }

  return out;
}
