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
import { bulkAssignManagerAction } from "@/app/[locale]/(app)/organization/actions"
import { buildOrganizationTree, flattenOrganizationTree } from "@/lib/organization/build-tree"
import { getFullName } from "@/lib/employees"
import type { EmployeeListItem } from "@/types/employee-profile"

interface BulkAssignManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The selected employees, all from the one company this panel/section
   * belongs to (UnassignedEmployeesPanel renders one instance per company
   * group — see organization-view.tsx) — never a mixed-company selection,
   * which is what keeps "each company's hierarchy stays separate" true by
   * construction rather than by a check this dialog has to perform. */
  employees: EmployeeListItem[]
  allEmployees: EmployeeListItem[]
  onAssigned: () => void
}

/**
 * §3/§7 of the Rəhbər Təyinatı spec — assign the same manager to every
 * selected employee at once, after showing exactly how many will be
 * affected and requiring an explicit confirmation. Candidate exclusion is
 * the union of every selected employee's own id and current descendants
 * (so the picker can never offer a choice that would self-reference or
 * cycle for ANY of them) plus the same-company restriction
 * ChangeManagerDialog already applies — bulkAssignManagerAction re-checks
 * all of this server-side regardless, this is just so the picker doesn't
 * show an obviously-wrong option.
 */
export function BulkAssignManagerDialog({
  open,
  onOpenChange,
  employees,
  allEmployees,
  onAssigned,
}: BulkAssignManagerDialogProps) {
  const t = useTranslations("OrganizationChart.bulkAssign")
  const tChange = useTranslations("OrganizationChart.changeManager")
  const router = useRouter()

  const [selectedManagerId, setSelectedManagerId] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const company = employees[0]?.company

  const excludedIds = useMemo(() => {
    const tree = buildOrganizationTree(allEmployees)
    const flat = flattenOrganizationTree(tree)
    const ids = new Set(employees.map((employee) => employee.id))
    for (const employee of employees) {
      const node = flat.find((n) => n.employee.id === employee.id)
      if (node) {
        for (const descendant of flattenOrganizationTree(node.children)) ids.add(descendant.employee.id)
      }
    }
    return ids
  }, [allEmployees, employees])

  const options = useMemo(() => {
    const candidates = allEmployees
      .filter(
        (candidate) =>
          candidate.employmentStatus !== "terminated" &&
          !excludedIds.has(candidate.id) &&
          candidate.company === company
      )
      .map((candidate) => ({
        value: candidate.id,
        label: getFullName(candidate),
        hint: candidate.position,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return candidates
  }, [allEmployees, excludedIds, company])

  async function handleSave() {
    if (!selectedManagerId) return
    setIsSaving(true)
    setError(null)
    const result = await bulkAssignManagerAction(
      employees.map((employee) => employee.id),
      selectedManagerId
    )
    setIsSaving(false)

    if (result.success) {
      onOpenChange(false)
      onAssigned()
      router.refresh()
    } else {
      setError(tChange(`errors.${result.error}`))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { count: employees.length })}</DialogDescription>
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
          placeholder={tChange("placeholder")}
          searchPlaceholder={tChange("searchPlaceholder")}
          emptyText={tChange("noOptions")}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {tChange("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedManagerId}>
            {isSaving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
            {t("confirm", { count: employees.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
