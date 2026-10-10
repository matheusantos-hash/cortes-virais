import { streamDownloadVideo } from "./media.js";

interface PixabayVideoFile {
  url: string;
  width: number;
  height: number;
  size: number;
}

interface PixabayVideo {
  id: number;
  duration: number;
  videos: {
    large?: PixabayVideoFile;
    medium?: PixabayVideoFile;
    small?: PixabayVideoFile;
    tiny?: PixabayVideoFile;
  };
}

interface PixabaySearchResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideo[];
}

/**
 * Busca um vídeo de banco no Pixabay (API gratuita, uso comercial sem atribuição).
 * Docs: https://pixabay.com/api/docs/#api_search_videos
 * A API de vídeos não filtra por orientação, então filtramos localmente pela proporção.
 * Retorna o caminho do arquivo baixado ou null se não houver chave/resultado.
 */
export async function fetchPixabayBroll(params: {
  query: string;
  outPath: string;
  orientation?: "portrait" | "landscape";
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<string | null> {
  const { query, outPath, orientation = "portrait", signal, onLog } = params;
  const apiKey = process.env.PIXABAY_API_KEY?.trim();

  if (!apiKey) {
    onLog?.("[B-ROLL] Aviso: PIXABAY_API_KEY não configurada no ambiente. B-Roll pulado.");
    return null;
  }

  try {
    // O Pixabay exige TODOS os termos da busca; descrições longas quase nunca retornam nada.
    // Por isso tentamos versões progressivamente mais curtas da busca.
    const STOP = new Set(["a", "an", "the", "of", "on", "in", "with", "and", "at", "for", "to", "from", "by", "cinematic", "dramatic", "lighting", "close-up", "closeup", "shot", "view"]);
    const words = query.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
    const core = words.filter((w) => !STOP.has(w));
    const queries = [
      words.join(" "),
      core.slice(0, 3).join(" "),
      core.slice(0, 2).join(" "),
      core.slice(-2).join(" "),
      core[core.length - 1] ?? "",
    ]
      .map((s) => s.trim().slice(0, 100))
      .filter((s, idx, arr) => s && arr.indexOf(s) === idx);

    let data: PixabaySearchResponse | null = null;
    let q = "";
    for (const attempt of queries) {
      q = attempt;
      const searchUrl =
        `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}` +
        `&q=${encodeURIComponent(q)}&video_type=film&safesearch=true&per_page=20`;
      onLog?.(`[B-ROLL] Pesquisando vídeo no Pixabay para: "${q}" (${orientation})...`);

      const res = await fetch(searchUrl, { signal });
      if (!res.ok) {
        onLog?.(`[B-ROLL] Pixabay retornou status ${res.status}: ${res.statusText}`);
        return null;
      }
      const json = (await res.json()) as PixabaySearchResponse;
      if (json.hits?.length) {
        data = json;
        break;
      }
    }

    if (!data) {
      onLog?.(`[B-ROLL] Nenhum vídeo encontrado no Pixabay para "${query}".`);
      return null;
    }

    // Arquivo preferido de cada vídeo: o mais próximo de 1080 px no lado menor
    const pickFile = (v: PixabayVideo): PixabayVideoFile | null => {
      const files = [v.videos.large, v.videos.medium, v.videos.small, v.videos.tiny].filter(
        (f): f is PixabayVideoFile => Boolean(f?.url) && (f?.width ?? 0) > 0
      );
      if (!files.length) return null;
      files.sort(
        (a, b) => Math.abs(Math.min(a.width, a.height) - 1080) - Math.abs(Math.min(b.width, b.height) - 1080)
      );
      return files[0];
    };

    const candidates = data.hits
      .map((v) => ({ video: v, file: pickFile(v) }))
      .filter((c): c is { video: PixabayVideo; file: PixabayVideoFile } => c.file !== null);

    if (!candidates.length) {
      onLog?.("[B-ROLL] Nenhum arquivo MP4 disponível nos resultados do Pixabay.");
      return null;
    }

    // Prioriza vídeos na orientação certa; o FFmpeg recorta os demais se necessário
    const wantsPortrait = orientation === "portrait";
    const matching = candidates.filter((c) =>
      wantsPortrait ? c.file.height > c.file.width : c.file.width >= c.file.height
    );
    const chosen = (matching[0] ?? candidates[0]);

    onLog?.(
      `[B-ROLL] Baixando clipe B-roll do Pixabay (${chosen.file.width}x${chosen.file.height}, ~${chosen.video.duration}s)...`
    );

    await streamDownloadVideo(chosen.file.url, outPath, signal);
    onLog?.(`[B-ROLL] Vídeo do Pixabay baixado com sucesso: ${outPath}`);
    return outPath;
  } catch (err: any) {
    if (signal?.aborted) throw err;
    onLog?.(`[B-ROLL] Erro ao obter vídeo do Pixabay: ${err.message}`);
    return null;
  }
}
