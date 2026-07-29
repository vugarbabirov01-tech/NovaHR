/**
 * The one seam every document's bytes flow through — deliberately narrow
 * (store/retrieve/delete, nothing else) so a storage backend swap never
 * touches business logic. mimeType is intentionally not part of this
 * interface: the Document metadata row already carries it, so the provider's
 * only job is raw byte storage.
 */
export interface DocumentStorageProvider {
  store(storageKey: string, data: Buffer): Promise<void>
  retrieve(storageKey: string): Promise<Buffer | null>
  delete(storageKey: string): Promise<void>
}
