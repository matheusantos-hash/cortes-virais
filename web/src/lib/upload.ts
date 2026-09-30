import * as tus from "tus-js-client";
import { supabaseUrl } from "./supabase/env";

/**
 * Envio "retomável" (protocolo TUS) para o Storage do Supabase.
 * Recomendado para arquivos grandes: envia em pedaços de 6 MB e tenta de novo se a conexão oscilar.
 */
export function uploadResumable(opts: {
  accessToken: string;
  bucket: string;
  path: string;
  file: File;
  onProgress: (percent: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(opts.file, {
      endpoint: `${supabaseUrl()}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${opts.accessToken}`, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false, // cada envio usa um caminho novo; não retomar de outro
      metadata: {
        bucketName: opts.bucket,
        objectName: opts.path,
        contentType: opts.file.type || "video/mp4",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024, // o Supabase exige 6 MB
      onError: (err) => reject(err),
      onProgress: (sent, total) => opts.onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}
