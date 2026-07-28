import type { AssetStatus } from "@/types/employee-profile"
import { defaultOffboardingChecklist, type OffboardingChecklistState, type TerminationReason } from "@/types/offboarding"

/**
 * Client-side wizard form state — Step 1 fields plus the local, in-progress
 * asset return decisions and checklist. Nothing here is persisted until
 * Finish; the wizard holds it, the Termination Server Action writes it.
 */
export interface TerminationWizardData {
  terminationDate: string
  lastWorkingDay: string
  reason: TerminationReason | ""
  labourCodeArticle: string
  notes: string
  /** assetId -> chosen return status, overriding the provider's current status */
  assetReturns: Record<string, AssetStatus>
  checklist: OffboardingChecklistState
}

export const defaultTerminationWizardData: TerminationWizardData = {
  terminationDate: "",
  lastWorkingDay: "",
  reason: "",
  labourCodeArticle: "",
  notes: "",
  assetReturns: {},
  checklist: defaultOffboardingChecklist,
}
