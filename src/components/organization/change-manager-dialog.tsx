"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SearchableSelect } from "@/components/common/searchable-select"
import { useRouter } from "@/i18n/navigation"
import { updateEmployeeManagerAction } from "@/app/[locale]/(app)/organization/actions"
import { buildOrganizationTree, flattenOrganizationTree } from "@/lib/organization/build-tree"
import { getFullName } from "@/lib/employees"
import type { EmployeeListItem } from "@/types/employee-profile"

interface ChangeManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem
  /** The same full employee list every Organization Chart surface already
   * has loaded (organization/page.tsx) — candidates are derived from this,
   * never a separate fetch, same "one real source, read once" convention
   * the rest of this page already follows. */
  employees: EmployeeListItem[]
}

/**
 * SearchableSelect (src/components/common/searchable-select.tsx) over the
 * same real, non-terminated employee set getManagerOptions() already
 * builds (src/data/manager-directory.ts) — computed here instead of
 * calling that server-only function, since the data it would fetch is the
 * exact `employees` prop this page already loaded once. Self and every
 * current descendant are excluded from the list client-side so the picker
 * never even offers an invalid choice; updateEmployeeManagerAction
 * (organization/actions.ts) is the real, authoritative guard against both.
 */
export function ChangeManagerDialog({ open, onOpenChange, employee, employees }: ChangeManagerDialogProps) {
  const t = useTranslations("OrganizationChart.changeManager")
  const router = useRouter()

  const [selectedManagerId, setSelectedManagerId] = useState(employee.managerId ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const excludedIds = useMemo(() => {
    const tree = buildOrganizationTree(employees)
    const node = flattenOrganizationTree(tree).find((n) => n.employee.id === employee.id)
    const descendantIds = node ? flattenOrganizationTree(node.children).map((n) => n.employee.id) : []
    return new Set([employee.id, ...descendantIds])
  }, [employees, employee.id])

  const options = useMemo(() => {
    const candidates = employees
      .filter(
        (candidate) =>
          candidate.employmentStatus !== "terminated" &&
          !excludedIds.has(candidate.id) &&
          candidate.company === employee.company
      )
      .map((candidate) => ({
        value: candidate.id,
        label: getFullName(candidate),
        hint: candidate.position,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
    // "" clears managerId entirely — the employee becomes a root, same as
    // anyone HR never assigned a manager to in the first place.
    return [{ value: "", label: t("noManager") }, ...candidates]
  }, [employees, excludedIds, employee.company, t])

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    const result = await updateEmployeeManagerAction(employee.id, selectedManagerId || null)
    setIsSaving(false)

    if (result.success) {
      onOpenChange(false)
      router.refresh()
    } else {
      setError(t(`errors.${result.error}`))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { name: getFullName(employee) })}</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <SearchableSelect
          value={selectedManagerId}
          onValueChange={setSelectedManagerId}
          options={options}
          placeholder={t("placeholder")}
          searchPlaceholder={t("searchPlaceholder")}
          emptyText={t("noOptions")}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
