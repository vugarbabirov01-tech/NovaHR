"use client"

import { useTranslations } from "next-intl"
import { History, PenLine, Sparkles } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { EmptyState } from "@/components/common/empty-state"
import { Timeline, type TimelineEntry } from "@/components/common/timeline"
import type { AuditLogEntry, EmployeeProfile } from "@/types/employee-profile"

interface AuditLogTabProps {
  profile: EmployeeProfile
}

export function AuditLogTab({ profile }: AuditLogTabProps) {
  const t = useTranslations("Employees.profile.auditLog")
  const tActions = useTranslations("Employees.profile.auditLog.actions")
  const { auditLog } = profile

  const entries: TimelineEntry[] = auditLog.map((entry) => ({
    id: entry.id,
    icon: entry.action === "record.created" ? Sparkles : PenLine,
    title: entry.actor,
    description: describeAction(entry, tActions, t),
    meta: new Date(entry.timestamp).toLocaleString(),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState icon={History} title={t("noEntries")} />
        ) : (
          <Timeline entries={entries} />
        )}
      </CardContent>
    </Card>
  )
}

const actionMessageKeys: Record<string, "recordCreated" | "fieldUpdated"> = {
  "record.created": "recordCreated",
  "field.updated": "fieldUpdated",
}

function describeAction(
  entry: AuditLogEntry,
  tActions: ReturnType<typeof useTranslations>,
  t: ReturnType<typeof useTranslations>
) {
  if (entry.action === "field.updated" && entry.field) {
    return t("fieldChanged", {
      field: entry.field,
      oldValue: entry.oldValue ?? "",
      newValue: entry.newValue ?? "",
    })
  }

  return tActions(actionMessageKeys[entry.action] ?? "recordCreated")
}
