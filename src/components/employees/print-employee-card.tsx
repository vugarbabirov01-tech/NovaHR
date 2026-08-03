"use client"

import { useEffect } from "react"

import { EmployeeCard } from "@/components/employees/employee-card"
import type { WorkStatus } from "@/lib/employee-work-status"
import type { EmployeeListItem } from "@/types/employee-profile"

interface PrintEmployeeCardProps {
  employee: EmployeeListItem
  /** Resolved server-side (see employees/[id]/print/page.tsx). */
  workStatus: WorkStatus
}

/**
 * Auto-opens the browser print dialog on mount. Lives on its own route
 * (rather than firing window.print() from the list) so only this one
 * employee's card is in the print target, not the whole card grid.
 */
export function PrintEmployeeCard({ employee, workStatus }: PrintEmployeeCardProps) {
  useEffect(() => {
    window.print()
  }, [])

  return (
    <div className="mx-auto w-full max-w-sm print:max-w-none">
      <EmployeeCard employee={employee} workStatus={workStatus} />
    </div>
  )
}
