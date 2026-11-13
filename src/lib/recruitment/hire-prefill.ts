import type { WizardMasterData } from "@/lib/employee-wizard-mapper"
import { normalizeReferenceName } from "@/lib/reference-data/normalize-name"
import { defaultWizardData, type EmployeeWizardData } from "@/types/employee-wizard"

export interface HirePrefillSource {
  candidate: { firstName: string; lastName: string; fatherName: string; phone: string; email: string; finCode: string }
  requisition: { title: string; departmentId: string | null; branchId: string | null }
  offer: { salary: number; startDate: string } | null
}

/**
 * Pre-fills the new-employee wizard from a candidate and the accepted offer.
 * Department, branch and net salary come from the vacancy/offer; the position
 * and company are matched against the master data (a position only matches
 * inside the same department, by normalised title). Anything that cannot be
 * resolved is left blank for HR to complete in the wizard.
 */
export function buildHireWizardData(source: HirePrefillSource, masterData: WizardMasterData): EmployeeWizardData {
  const { candidate, requisition, offer } = source

  const wantedTitle = normalizeReferenceName(requisition.title)
  const position = requisition.departmentId
    ? masterData.positions.find(
        (p) => p.departmentId === requisition.departmentId && normalizeReferenceName(p.title) === wantedTitle
      )
    : undefined
  const department = requisition.departmentId
    ? masterData.departments.find((d) => d.id === requisition.departmentId)
    : undefined
  const branch = requisition.branchId ? masterData.branches.find((b) => b.id === requisition.branchId) : undefined

  return {
    ...defaultWizardData,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    fatherName: candidate.fatherName,
    phone: candidate.phone,
    email: candidate.email,
    finCode: candidate.finCode,
    hireDate: offer?.startDate ?? "",
    departmentId: department?.id ?? "",
    positionId: position?.id ?? "",
    branchId: branch?.id ?? "",
    companyId: branch?.companyId ?? "",
    baseSalary: offer?.salary ?? "",
  }
}
