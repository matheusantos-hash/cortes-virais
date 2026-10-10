/**
 * Cache de URLs assinadas do Supabase Storage em memória e sessionStorage.
 * Evita roundtrips repetidos à API do Supabase e estabiliza a querystring das URLs,
 * permitindo que o cache HTTP nativo do navegador reaproveite imagens e vídeos baixados.
 */

interface CachedUrl {
  url: string;
  expiresAt: number;
}

const memoryCache = new Map<string, CachedUrl>();

// 50 minutos de validade no cliente (Supabase assina por 60 min)
const CACHE_TTL_MS = 50 * 60 * 1000;
const STORAGE_PREFIX = "cortes_signed_url:";

function getFromStorage(key: string): CachedUrl | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUrl;
    if (parsed.expiresAt > Date.now()) {
      return parsed;
    }
    window.sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {}
  return null;
}

function setInStorage(key: string, data: CachedUrl) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch {}
}

/**
 * Obtém URLs assinadas em lote com cache transparente.
 */
export async function getSignedUrlsCached(
  supabase: any,
  bucket: string,
  paths: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missingPaths: string[] = [];
  const now = Date.now();

  for (const path of paths) {
    if (!path) continue;
    const cacheKey = `${bucket}:${path}`;
    
    // 1. Tenta cache em memória
    const inMem = memoryCache.get(cacheKey);
    if (inMem && inMem.expiresAt > now) {
      result[path] = inMem.url;
      continue;
    }

    // 2. Tenta sessionStorage
    const inStorage = getFromStorage(cacheKey);
    if (inStorage) {
      memoryCache.set(cacheKey, inStorage);
      result[path] = inStorage.url;
      continue;
    }

    // 3. Marca para solicitar ao Supabase
    if (!missingPaths.includes(path)) {
      missingPaths.push(path);
    }
  }

  if (missingPaths.length === 0) {
    return result;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(missingPaths, 3600);

    if (!error && data) {
      data.forEach((item: { path: string | null; signedUrl: string | null }) => {
        if (item.path && item.signedUrl) {
          const cacheKey = `${bucket}:${item.path}`;
          const entry: CachedUrl = {
            url: item.signedUrl,
            expiresAt: now + CACHE_TTL_MS,
          };
          memoryCache.set(cacheKey, entry);
          setInStorage(cacheKey, entry);
          result[item.path] = item.signedUrl;
        }
      });
    }
  } catch (err) {
    console.warn("Erro ao obter URLs assinadas em lote:", err);
  }

  return result;
}

/**
 * Invalida o cache de um caminho específico (ex: quando um clipe é re-renderizado ou excluído).
 */
export function invalidateSignedUrl(bucket: string, path: string) {
  const cacheKey = `${bucket}:${path}`;
  memoryCache.delete(cacheKey);
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(STORAGE_PREFIX + cacheKey);
    } catch {}
  }
}
