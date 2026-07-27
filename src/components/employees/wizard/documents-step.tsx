"use client"

import { useTranslations } from "next-intl"
import { FileText, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FormSection } from "@/components/common/form-section"
import { FileDropzone } from "@/components/common/file-dropzone"
import { EmptyState } from "@/components/common/empty-state"
import type { EmployeeWizardData } from "@/types/employee-wizard"
import type { DocumentCategory } from "@/types/employee-profile"

interface StepProps {
  data: EmployeeWizardData
  onChange: (patch: Partial<EmployeeWizardData>) => void
}

export function DocumentsStep({ data, onChange }: StepProps) {
  const t = useTranslations("Employees.profile.documents")
  const tTabs = useTranslations("Employees.profile.tabs")

  function handleFiles(files: File[], category: DocumentCategory) {
    const newDocs = files.map((file) => ({
      id: `${category}-${Date.now()}-${file.name}`,
      name: file.name,
      category,
    }))
    onChange({ documents: [...data.documents, ...newDocs] })
  }

  function removeDocument(id: string) {
    onChange({ documents: data.documents.filter((doc) => doc.id !== id) })
  }

  return (
    <FormSection title={tTabs("documents")}>
      <div className="flex flex-col gap-4">
        <FileDropzone
          label={t("uploadArea")}
          hint={t("uploadHint")}
          onFiles={(files) => handleFiles(files, "other")}
        />

        {data.documents.length === 0 ? (
          <EmptyState icon={FileText} title={t("noDocuments")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  <span className="text-foreground">{doc.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeDocument(doc.id)}
                  aria-label="Remove"
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormSection>
  )
}
