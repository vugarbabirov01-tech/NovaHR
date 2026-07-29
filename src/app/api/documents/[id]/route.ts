import { NextResponse } from "next/server"

import { getDocumentById } from "@/lib/documents/document-service"
import { documentStorageProvider } from "@/lib/integrations/document-storage-provider"

/**
 * The one generic route for viewing/printing any document, from any module
 * — Server Actions can't stream arbitrary binary responses with the right
 * Content-Type, so this is the sole exception to "every endpoint is a
 * Server Action" in this app, scoped narrowly to byte serving. Never
 * touches the filesystem itself — only the storage provider does, so this
 * route is unaffected by whichever provider is active.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const document = await getDocumentById(id)
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 })
  }

  const data = await documentStorageProvider.retrieve(document.storageKey)
  if (!data) {
    return NextResponse.json({ error: "Document content not found." }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
      "Content-Length": String(document.fileSize),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}
