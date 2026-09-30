import { readFile } from "node:fs/promises";
import type { Word } from "./types.js";

/** Transcreve o áudio no Deepgram e devolve as palavras com timestamps. */
export async function transcribe(audioPath: string, language: string): Promise<Word[]> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("Falta DEEPGRAM_API_KEY no .env");

  const params = new URLSearchParams({
    model: process.env.DEEPGRAM_MODEL ?? "nova-3",
    language,
    smart_format: "true",
    punctuate: "true",
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "audio/mpeg",
    },
    body: await readFile(audioPath),
  });

  if (!res.ok) {
    throw new Error(`Deepgram respondeu ${res.status}: ${await res.text()}`);
  }

  const json: any = await res.json();
  const words: Word[] | undefined = json?.results?.channels?.[0]?.alternatives?.[0]?.words;
  if (!words?.length) throw new Error("O Deepgram não devolveu palavras. O áudio tem fala?");
  return words;
}
