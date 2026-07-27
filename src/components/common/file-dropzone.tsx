"use client"

import { useRef, useState } from "react"
import { UploadCloud } from "lucide-react"

import { cn } from "@/lib/utils"

interface FileDropzoneProps {
  label: string
  hint: string
  onFiles?: (files: File[]) => void
  className?: string
}

export function FileDropzone({ label, hint, onFiles, className }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    onFiles?.(Array.from(files))
  }

  return (
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
        handleFiles(event.dataTransfer.files)
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
        isDragging ? "border-primary bg-accent/50" : "border-border hover:bg-muted/40",
        className
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-full bg-accent">
        <UploadCloud className="size-4 text-accent-foreground" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  )
}
