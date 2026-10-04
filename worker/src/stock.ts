import { fetchPexelsBroll } from "./pexels.js";
import { fetchPixabayBroll } from "./pixabay.js";

/**
 * Busca um B-roll em bancos de vídeo gratuitos.
 * Ordem: Pixabay (principal) → Pexels (só se PEXELS_API_KEY estiver configurada).
 */
export async function fetchStockBroll(params: {
  query: string;
  outPath: string;
  orientation?: "portrait" | "landscape";
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<string | null> {
  const hasPixabay = Boolean(process.env.PIXABAY_API_KEY?.trim());
  const hasPexels = Boolean(process.env.PEXELS_API_KEY?.trim());

  if (!hasPixabay && !hasPexels) {
    params.onLog?.("[B-ROLL] Nenhum banco de vídeos configurado (defina PIXABAY_API_KEY no .env). B-Roll pulado.");
    return null;
  }

  if (hasPixabay) {
    const file = await fetchPixabayBroll(params);
    if (file) return file;
  }
  if (hasPexels) {
    return fetchPexelsBroll(params);
  }
  return null;
}
