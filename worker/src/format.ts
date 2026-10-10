/**
 * Formata segundos em MM:SS ou HH:MM:SS de forma segura.
 */
export function fmtClock(sec: number | string | undefined | null): string {
  if (!sec || isNaN(Number(sec))) return "0:00";
  const s = Math.floor(Number(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
