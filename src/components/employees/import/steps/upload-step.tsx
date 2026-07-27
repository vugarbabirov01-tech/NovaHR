"use client"

import { useTranslations } from "next-intl"

import { FileDropzone } from "@/components/common/file-dropzone"

interface UploadStepProps {
  onFileSelected: (file: File) => void
}

export function UploadStep({ onFileSelected }: UploadStepProps) {
  const t = useTranslations("Employees.import.upload")

  return (
    <FileDropzone
      label={t("dropzoneLabel")}
      hint={t("dropzoneHint")}
      accept=".xlsx,.csv"
      onFiles={(files) => {
        const file = files[0]
        if (file) onFileSelected(file)
      }}
    />
  )
}
