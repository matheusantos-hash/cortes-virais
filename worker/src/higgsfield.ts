import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

interface MediaOutput {
  url: string;
}

interface RequestStatusResponse {
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";
  request_id: string;
  status_url?: string;
  cancel_url?: string;
  video?: MediaOutput;
  images?: MediaOutput[];
  error?: string | null;
  detail?: string;
}

/**
 * Cliente oficial para geração de vídeo com IA generativa via Higgsfield API.
 * Especificação: OpenAPI 3.1.0 (https://docs.higgsfield.ai/docs/openapi.json)
 */
export class HiggsfieldClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.HIGGSFIELD_API_KEY?.trim() || "";
    this.baseUrl = process.env.HIGGSFIELD_API_URL?.trim() || "https://api.higgsfield.ai";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Constrói o cabeçalho Authorization no formato oficial da Higgsfield:
   * Authorization: Key {api_key_id}:{api_key_secret}
   */
  private getHeaders(): Record<string, string> {
    const auth = this.apiKey.startsWith("Key ")
      ? this.apiKey
      : `Key ${this.apiKey}`;

    return {
      "Authorization": auth,
      "Content-Type": "application/json",
    };
  }

  /**
   * Envia requisição para gerar um vídeo com IA baseado em prompt visual.
   * Utiliza os modelos oficiais de text-to-video (Kling / Minimax Hailuo).
   */
  async submitGeneration(params: {
    prompt: string;
    durationSec?: number;
    signal?: AbortSignal;
    onLog?: (line: string) => void;
  }): Promise<{ requestId: string; statusUrl: string }> {
    const { prompt, durationSec = 5, signal, onLog } = params;

    onLog?.(`[HIGGSFIELD AI] Enviando prompt para geração de vídeo: "${prompt.slice(0, 80)}..."`);

    // Modelos disponíveis no OpenAPI oficial:
    // 1. /kling-video/v2.5-turbo/pro/text-to-video (duration: 5 ou 10)
    // 2. /minimax/hailuo-2.3/standard/text-to-video (duration: 6 ou 10)
    const klingUrl = `${this.baseUrl}/kling-video/v2.5-turbo/pro/text-to-video`;
    const duration = durationSec > 5 ? 10 : 5;

    let res = await fetch(klingUrl, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        prompt,
        duration,
        cfg_scale: 0.5,
      }),
      signal,
    });

    // Se o Kling não estiver disponível na conta, tenta o Minimax Hailuo
    if (!res.ok && res.status !== 401 && res.status !== 403) {
      const minimaxUrl = `${this.baseUrl}/minimax/hailuo-2.3/standard/text-to-video`;
      res = await fetch(minimaxUrl, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          prompt,
          duration: 6,
          prompt_optimizer: true,
        }),
        signal,
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Higgsfield API retornou status ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as RequestStatusResponse;
    if (!data.request_id) {
      throw new Error("Higgsfield não retornou request_id válido.");
    }

    const statusUrl = data.status_url || `${this.baseUrl}/requests/${data.request_id}/status`;
    return { requestId: data.request_id, statusUrl };
  }

  /**
   * Aguarda a conclusão da tarefa com polling inteligente conforme a spec oficial.
   */
  async pollTask(
    statusUrl: string,
    params: { signal?: AbortSignal; onLog?: (line: string) => void; timeoutSec?: number }
  ): Promise<string> {
    const { signal, onLog, timeoutSec = 150 } = params;
    const start = Date.now();
    const pollInterval = 4000; // 4 segundos

    while (Date.now() - start < timeoutSec * 1000) {
      if (signal?.aborted) throw new Error("Geração cancelada.");

      await new Promise((r) => setTimeout(r, pollInterval));

      const res = await fetch(statusUrl, {
        headers: this.getHeaders(),
        signal,
      });

      if (!res.ok) {
        onLog?.(`[HIGGSFIELD AI] Polling HTTP ${res.status}. Aguardando processamento da GPU...`);
        continue;
      }

      const data = (await res.json()) as RequestStatusResponse;

      if (data.status === "completed") {
        const videoUrl = data.video?.url || (data.images && data.images[0]?.url);
        if (videoUrl) return videoUrl;
        throw new Error("Higgsfield concluiu a tarefa, mas não retornou URL do vídeo.");
      }

      if (data.status === "failed" || data.status === "nsfw") {
        throw new Error(`Higgsfield falhou (status: ${data.status}): ${data.error || "Erro na geração"}`);
      }

      if (data.status === "canceled") {
        throw new Error("Higgsfield: tarefa foi cancelada.");
      }

      const elapsed = Math.round((Date.now() - start) / 1000);
      onLog?.(`[HIGGSFIELD AI] Renderizando vídeo com IA... (${elapsed}s decorridos)`);
    }

    throw new Error(`Tempo limite de ${timeoutSec}s atingido aguardando o Higgsfield.`);
  }

  /**
   * Baixa o arquivo do vídeo gerado diretamente para o disco.
   */
  async downloadVideo(videoUrl: string, destPath: string, signal?: AbortSignal): Promise<void> {
    const res = await fetch(videoUrl, { signal });
    if (!res.ok || !res.body) {
      throw new Error(`Falha ao baixar vídeo gerado do Higgsfield: HTTP ${res.status}`);
    }
    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(destPath), { signal });
  }
}

/**
 * Função utilitária para gerar e baixar um B-roll com Higgsfield AI.
 * Se a API key não estiver presente ou falhar, retorna null com log (permitindo fallback seguro).
 */
export async function fetchHiggsfieldBroll(params: {
  keyword: string;
  styleModifier?: string;
  outPath: string;
  orientation?: "portrait" | "landscape";
  durationSec?: number;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<string | null> {
  const { keyword, styleModifier, outPath, durationSec = 5, signal, onLog } = params;

  const client = new HiggsfieldClient();
  if (!client.isConfigured()) {
    onLog?.("[HIGGSFIELD AI] Aviso: HIGGSFIELD_API_KEY não configurada no worker/.env. Ativando fallback.");
    return null;
  }

  try {
    const combinedPrompt = styleModifier
      ? `${keyword}, ${styleModifier}, high quality cinematic 8k resolution, seamless movement`
      : `${keyword}, cinematic dramatic lighting, ultra detailed 8k, modern viral video aesthetic`;

    onLog?.(`[HIGGSFIELD AI] Disparando criação de vídeo com IA para o gancho: "${keyword}"...`);

    const { statusUrl } = await client.submitGeneration({
      prompt: combinedPrompt,
      durationSec,
      signal,
      onLog,
    });

    const videoUrl = await client.pollTask(statusUrl, { signal, onLog, timeoutSec: 120 });

    onLog?.("[HIGGSFIELD AI] Vídeo gerado com sucesso! Baixando arquivo para a máquina local...");
    await client.downloadVideo(videoUrl, outPath, signal);
    onLog?.("[HIGGSFIELD AI] B-Roll de IA baixado e pronto para o corte.");

    return outPath;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onLog?.(`[HIGGSFIELD AI] Falha na geração do vídeo IA (${msg}).`);
    return null;
  }
}
