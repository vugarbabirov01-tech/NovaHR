/**
 * Split out from reference-data-auto-resolver.ts on purpose: that module
 * imports @/lib/prisma and the master-data repositories (server-only,
 * Node-only — Prisma's runtime pulls in node:crypto/node:fs/node:events).
 * row-mapper.ts needs only this name constant, but it also has to stay
 * import-safe for employee-import.worker.ts, a genuine Web Worker bundled
 * for the browser — importing it from the Prisma-touching module would
 * drag its whole dependency graph into the worker bundle and break the
 * production build (UnhandledSchemeError on node:*). This file has no
 * imports of its own, so nothing that imports it can inherit a server-only
 * dependency by accident.
 */
export const FALLBACK_DEPARTMENT_NAME = "Ümumi Şöbə"
