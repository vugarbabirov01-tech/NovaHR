"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { FileText } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/common/empty-state"
import { FileDropzone } from "@/components/common/file-dropzone"
import type { DocumentCategory, EmployeeProfile } from "@/types/employee-profile"

interface DocumentsTabProps {
  profile: EmployeeProfile
}

export function DocumentsTab({ profile }: DocumentsTabProps) {
  const t = useTranslations("Employees.profile.documents")
  const tCategories = useTranslations("Employees.profile.documents.categories")
  const { documents } = profile

  const grouped = documents.reduce<Record<DocumentCategory, typeof documents>>(
    (acc, doc) => {
      acc[doc.category] = acc[doc.category] ? [...acc[doc.category], doc] : [doc]
      return acc
    },
    {} as Record<DocumentCategory, typeof documents>
  )

  const allCategories: DocumentCategory[] = [
    "national-id",
    "contract",
    "certificate",
    "diploma",
    "medical",
    "military",
    "other",
  ]

  // Employment Contract quick action deep-links here with ?category=contract
  // so the tab opens scoped to just that category instead of the full list.
  const searchParams = useSearchParams()
  const requestedCategory = searchParams.get("category")
  const isValidCategory = allCategories.includes(requestedCategory as DocumentCategory)
  const categories = isValidCategory ? [requestedCategory as DocumentCategory] : allCategories
  const visibleCategories = categories.filter((category) => grouped[category]?.length)

  return (
    <div className="flex flex-col gap-4">
      <FileDropzone label={t("uploadArea")} hint={t("uploadHint")} />

      <Card>
        <CardContent>
          {visibleCategories.length === 0 ? (
            <EmptyState icon={FileText} title={t("noDocuments")} />
          ) : (
            <div className="flex flex-col gap-5">
              {visibleCategories.map((category) => (
                  <div key={category} className="flex flex-col gap-2">
                    <CardHeader className="p-0">
                      <CardTitle className="text-sm">{tCategories(category)}</CardTitle>
                    </CardHeader>
                    <ul className="flex flex-col gap-2">
                      {grouped[category].map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2.5">
                            <FileText className="size-4 text-muted-foreground" strokeWidth={1.75} />
                            <span className="text-foreground">{doc.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{doc.fileSize}</span>
                            <span>{t("uploadedOn", { date: doc.uploadedAt })}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
