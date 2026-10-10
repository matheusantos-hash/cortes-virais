import { GoogleGenAI } from "@google/genai";

/**
 * Aguarda o arquivo processar no Google AI Files e mudar para 'ACTIVE'.
 * Se falhar ou exceder o timeout, lança um erro, impedindo travamentos silenciosos.
 */
export async function waitForActiveFile(
  ai: GoogleGenAI,
  fileName: string,
  maxWaitMs = 180_000,
  onLog?: (msg: string) => void
): Promise<void> {
  const start = Date.now();
  let lastLoggedSec = 0;

  while (Date.now() - start < maxWaitMs) {
    const file = await ai.files.get({ name: fileName });
    if (file.state === "ACTIVE") return;
    if (file.state === "FAILED") throw new Error(`O processamento do arquivo falhou nos servidores Gemini: ${fileName}`);

    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    if (elapsedSec - lastLoggedSec >= 15) {
      lastLoggedSec = elapsedSec;
      onLog?.(`[GEMINI] Aguardando processamento do arquivo (${elapsedSec}s)...`);
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("Tempo limite excedido aguardando processamento do arquivo no Google Gemini.");
}
