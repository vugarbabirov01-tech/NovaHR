// In-memory Import Draft store — same globalThis-pinning pattern as
// employee-directory.ts, for the same reason (Next.js dev server can
// re-instantiate a plain module-level array in a different execution
// context than the one that just mutated it).

import type { ImportDraft } from "@/lib/employee-import/types"

const globalForImportDrafts = globalThis as unknown as { importDrafts?: ImportDraft[] }

export const importDrafts: ImportDraft[] = globalForImportDrafts.importDrafts ?? []

if (process.env.NODE_ENV !== "production") {
  globalForImportDrafts.importDrafts = importDrafts
}

export function listImportDrafts(): ImportDraft[] {
  return [...importDrafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getImportDraft(id: string): ImportDraft | undefined {
  return importDrafts.find((draft) => draft.id === id)
}

export function saveImportDraft(draft: ImportDraft): void {
  const index = importDrafts.findIndex((existing) => existing.id === draft.id)
  if (index === -1) {
    importDrafts.unshift(draft)
  } else {
    importDrafts[index] = draft
  }
}

export function deleteImportDraft(id: string): void {
  const index = importDrafts.findIndex((draft) => draft.id === id)
  if (index !== -1) importDrafts.splice(index, 1)
}
