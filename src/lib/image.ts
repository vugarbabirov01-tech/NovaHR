const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export const MAX_PHOTO_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
export const PHOTO_OUTPUT_SIZE = 400

export function isSupportedImageFile(file: File): boolean {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)
}

/**
 * Center-crops an uploaded image to a square and re-encodes it as a
 * compressed JPEG data URL. Runs entirely client-side via canvas — there is
 * no upload endpoint yet, so the result is a portable `data:` string that
 * can flow through a Server Action and be stored directly as `photoUrl`.
 */
export function cropAndCompressImage(
  file: File,
  size = PHOTO_OUTPUT_SIZE,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read the selected file."))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error("Could not decode the selected image."))
      image.onload = () => {
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
        const sx = (image.naturalWidth - sourceSize) / 2
        const sy = (image.naturalHeight - sourceSize) / 2

        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas is not supported in this browser."))
          return
        }
        ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
