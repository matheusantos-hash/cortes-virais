import { streamDownloadVideo } from "./media.js";

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  fps: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  videos: PexelsVideo[];
}

/**
 * Busca um vídeo no Pexels de acordo com a palavra-chave e formato (portrait ou landscape).
 * Baixa o arquivo para o caminho local informado e retorna o caminho.
 * Se a API key não estiver presente ou não encontrar nada, retorna null.
 */
export async function fetchPexelsBroll(params: {
  query: string;
  outPath: string;
  orientation?: "portrait" | "landscape";
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<string | null> {
  const { query, outPath, orientation = "portrait", signal, onLog } = params;
  const apiKey = process.env.PEXELS_API_KEY?.trim();

  if (!apiKey) {
    onLog?.("[B-ROLL] Aviso: PEXELS_API_KEY não configurada no ambiente. B-Roll pulado.");
    return null;
  }

  try {
    const searchUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=5&size=medium`;
    onLog?.(`[B-ROLL] Pesquisando vídeo no Pexels para: "${query}" (${orientation})...`);

    const res = await fetch(searchUrl, {
      headers: {
        Authorization: apiKey,
      },
      signal,
    });

    if (!res.ok) {
      onLog?.(`[B-ROLL] Pexels retornou status ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as PexelsSearchResponse;
    if (!data.videos || data.videos.length === 0) {
      onLog?.(`[B-ROLL] Nenhum vídeo encontrado no Pexels para "${query}".`);
      return null;
    }

    // Pega o primeiro vídeo retornado
    const video = data.videos[0];
    // Escolhe o melhor arquivo mp4 (preferência por HD ou maior largura <= 1080)
    const mp4Files = video.video_files.filter((f) => f.file_type === "video/mp4");
    if (!mp4Files.length) {
      onLog?.("[B-ROLL] Nenhum arquivo MP4 disponível no vídeo selecionado.");
      return null;
    }

    // Ordena pelo mais próximo de 720/1080p
    mp4Files.sort((a, b) => {
      const diffA = Math.abs((a.width || 0) - 1080);
      const diffB = Math.abs((b.width || 0) - 1080);
      return diffA - diffB;
    });

    const chosenFile = mp4Files[0];
    onLog?.(`[B-ROLL] Baixando clipe B-roll do Pexels (${chosenFile.width}x${chosenFile.height}, ~${video.duration}s)...`);

    await streamDownloadVideo(chosenFile.link, outPath, signal);
    onLog?.(`[B-ROLL] Vídeo do Pexels baixado com sucesso: ${outPath}`);
    return outPath;
  } catch (err: any) {
    if (signal?.aborted) throw err;
    onLog?.(`[B-ROLL] Erro ao obter vídeo do Pexels: ${err.message}`);
    return null;
  }
}
