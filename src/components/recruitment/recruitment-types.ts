import type { PipelineStage } from "@/lib/recruitment/recruitment-rules"

export interface ApplicationNoteView {
  id: string
  kind: "NOTE" | "INTERVIEW"
  text: string
  rating: number | null
  /** ISO timestamp */
  createdAt: string
}

export interface ApplicationView {
  id: string
  stage: PipelineStage
  rejectionReason: string
  /** Employee created through the hire flow, if hired. */
  hiredEmployeeId: string | null
  offer: {
    status: string
    salary: number
    /** yyyy-mm-dd */
    startDate: string
    note: string
  } | null
  /** ISO timestamp of the last stage change */
  stageUpdatedAt: string
  candidate: {
    id: string
    fullName: string
    phone: string
    email: string
    finCode: string
    source: string
    notes: string
  }
  notes: ApplicationNoteView[]
}
