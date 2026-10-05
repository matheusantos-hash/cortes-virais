export interface FpsFraction {
  num: number;
  den: number;
}

/** Retorna a taxa nominal como número de ponto flutuante (ex.: 29.970029...). */
export function fpsValue(fps: FpsFraction): number {
  return fps.num / fps.den;
}

/** Indica se a taxa de quadros usa padrão drop-frame (29.97 ou 59.94 fps). */
export function isDropFrame(fps: FpsFraction): boolean {
  const v = fpsValue(fps);
  return Math.abs(v - 29.97) < 0.05 || Math.abs(v - 59.94) < 0.05;
}

/**
 * Converte segundos para contagem total de frames inteiros.
 */
export function secondsToFrames(seconds: number, fps: FpsFraction): number {
  return Math.round(seconds * (fps.num / fps.den));
}

/**
 * Converte contagem de frames para segundos.
 */
export function framesToSeconds(frames: number, fps: FpsFraction): number {
  return frames / (fps.num / fps.den);
}

/**
 * Formata um número de frames como Timecode SMPTE ("HH:MM:SS:FF" ou "HH:MM:SS;FF").
 */
export function framesToTimecode(totalFrames: number, fps: FpsFraction): string {
  const drop = isDropFrame(fps);
  const nominal = Math.round(fpsValue(fps));

  if (!drop) {
    let f = totalFrames;
    const ff = f % nominal;
    f = Math.floor(f / nominal);
    const ss = f % 60;
    f = Math.floor(f / 60);
    const mm = f % 60;
    const hh = Math.floor(f / 60);

    return [
      String(hh).padStart(2, "0"),
      String(mm).padStart(2, "0"),
      String(ss).padStart(2, "0"),
      String(ff).padStart(2, "0"),
    ].join(":");
  }

  // Algoritmo SMPTE 12M Drop Frame (para 29.97 fps padrão):
  // 2 frames descartados por minuto, exceto a cada 10 minutos (1798 frames por bloco de 10 min)
  const dropFrames = nominal === 60 ? 4 : 2;
  const framesPer10Min = Math.round(nominal * 60 * 10 - dropFrames * 9);
  const framesPerMin = Math.round(nominal * 60 - dropFrames);

  let frameNumber = totalFrames;
  const d = Math.floor(frameNumber / framesPer10Min);
  const m = frameNumber % framesPer10Min;

  if (m > dropFrames) {
    frameNumber += dropFrames * 9 * d + dropFrames * Math.floor((m - dropFrames) / framesPerMin);
  } else {
    frameNumber += dropFrames * 9 * d;
  }

  const ff = frameNumber % nominal;
  const ss = Math.floor(frameNumber / nominal) % 60;
  const mm = Math.floor(Math.floor(frameNumber / nominal) / 60) % 60;
  const hh = Math.floor(Math.floor(Math.floor(frameNumber / nominal) / 60) / 60);

  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")};${String(ff).padStart(2, "0")}`;
}

/**
 * Converte string de timecode SMPTE ("01:00:00:00" ou "01:00:00;00") de volta para frames inteiros.
 */
export function timecodeToFrames(tc: string, fps: FpsFraction): number {
  const parts = tc.split(/[:;.]/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return 0;
  const [hh, mm, ss, ff] = parts;
  const nominal = Math.round(fpsValue(fps));

  if (!isDropFrame(fps)) {
    return ((hh * 60 + mm) * 60 + ss) * nominal + ff;
  }

  const dropFrames = nominal === 60 ? 4 : 2;
  const totalMinutes = hh * 60 + mm;
  const totalFrames =
    ((hh * 60 + mm) * 60 + ss) * nominal +
    ff -
    dropFrames * (totalMinutes - Math.floor(totalMinutes / 10));

  return totalFrames;
}
