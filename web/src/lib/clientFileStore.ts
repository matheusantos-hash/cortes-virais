/**
 * Cache em memória para o arquivo local durante o ciclo de vida do Job.
 * Permite que a tela /jobs/[id] acesse o File original selecionado no NewJobForm
 * para realizar o fatiamento instantâneo sem necessitar de novo upload.
 */

const memoryStore = new Map<string, File>();

export function storeLocalVideoFile(key: string, file: File): void {
  if (!key || !file) return;
  memoryStore.set(key, file);
}

export function getLocalVideoFile(key: string): File | undefined {
  if (!key) return undefined;
  return memoryStore.get(key);
}

export function clearLocalVideoFile(key: string): void {
  if (!key) return;
  memoryStore.delete(key);
}

/**
 * Procura um arquivo no cache por nome e tamanho aproximado caso o ID específico mude.
 */
export function findLocalVideoFile(fileName: string, fileSize?: number): File | undefined {
  for (const file of memoryStore.values()) {
    if (file.name === fileName) {
      if (!fileSize || Math.abs(file.size - fileSize) < 1024) {
        return file;
      }
    }
  }
  return undefined;
}
