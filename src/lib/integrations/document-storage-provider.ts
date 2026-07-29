import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import type { DocumentStorageProvider } from "@/types/integrations/document-storage"

// Local filesystem — the dev implementation. Swapping to MinIO/S3/Azure
// Blob later means writing one new class implementing the same three
// methods and pointing the singleton below at it; document-service.ts, the
// repository, and the /api/documents/[id] route never know which one is
// active. Not under public/ — files are only ever reachable through the
// route handler, never served directly by Next's static file server.
const STORAGE_DIR = path.join(process.cwd(), "storage", "documents")

class LocalFileStorageProvider implements DocumentStorageProvider {
  async store(storageKey: string, data: Buffer): Promise<void> {
    await mkdir(STORAGE_DIR, { recursive: true })
    await writeFile(path.join(STORAGE_DIR, storageKey), data)
  }

  async retrieve(storageKey: string): Promise<Buffer | null> {
    try {
      return await readFile(path.join(STORAGE_DIR, storageKey))
    } catch {
      return null
    }
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(path.join(STORAGE_DIR, storageKey)).catch(() => {})
  }
}

export const documentStorageProvider: DocumentStorageProvider = new LocalFileStorageProvider()
