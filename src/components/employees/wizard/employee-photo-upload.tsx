"use client"

import { useRef, useState, type MouseEvent } from "react"
import { useTranslations } from "next-intl"
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { cropAndCompressImage, isSupportedImageFile, MAX_PHOTO_FILE_SIZE } from "@/lib/image"

interface EmployeePhotoUploadProps {
  value: string
  onChange: (dataUrl: string) => void
  firstName?: string
  lastName?: string
  error?: string
}

export function EmployeePhotoUpload({
  value,
  onChange,
  firstName,
  lastName,
  error,
}: EmployeePhotoUploadProps) {
  const t = useTranslations("Employees.wizard.photo")
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [localError, setLocalError] = useState("")

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase()

  async function processFile(file: File | undefined) {
    if (!file) return
    setLocalError("")

    if (!isSupportedImageFile(file)) {
      setLocalError(t("errorType"))
      return
    }
    if (file.size > MAX_PHOTO_FILE_SIZE) {
      setLocalError(t("errorSize"))
      return
    }

    setIsProcessing(true)
    try {
      const dataUrl = await cropAndCompressImage(file)
      onChange(dataUrl)
    } catch {
      setLocalError(t("errorGeneric"))
    } finally {
      setIsProcessing(false)
    }
  }

  function handleRemove(event: MouseEvent) {
    event.stopPropagation()
    onChange("")
    setLocalError("")
    if (inputRef.current) inputRef.current.value = ""
  }

  const message = error || localError

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          void processFile(event.dataTransfer.files?.[0])
        }}
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-xl border border-dashed px-4 py-4 transition-colors",
          isDragging
            ? "border-primary bg-accent/50"
            : message
              ? "border-destructive"
              : "border-border hover:bg-muted/40"
        )}
      >
        <Avatar className="size-20 shrink-0 shadow-sm ring-4 ring-background">
          {value ? <AvatarImage src={value} alt={t("previewAlt")} /> : null}
          <AvatarFallback className="bg-accent text-lg font-medium text-accent-foreground">
            {isProcessing ? (
              <Loader2 className="size-5 animate-spin" strokeWidth={1.75} />
            ) : (
              initials || <ImagePlus className="size-5" strokeWidth={1.75} />
            )}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {value ? t("changeLabel") : t("uploadLabel")}
          </p>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>

        {value ? (
          <Button variant="ghost" size="icon-sm" onClick={handleRemove} aria-label={t("remove")}>
            <Trash2 className="size-4" strokeWidth={1.75} />
          </Button>
        ) : (
          <UploadCloud className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            void processFile(event.target.files?.[0])
          }}
        />
      </div>
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  )
}
