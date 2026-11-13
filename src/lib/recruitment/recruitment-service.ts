import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import {
  acceptsApplications,
  canTransitionRequisition,
  findDuplicateCandidates,
  isPipelineStage,
  isRequisitionEditable,
  normalizeEmail,
  normalizeFin,
  validateCandidateInput,
  validateRequisitionInput,
  validateStageMove,
  type CandidateInput,
  type PipelineStage,
  type RequisitionInput,
  type RequisitionStatus,
} from "@/lib/recruitment/recruitment-rules"

export type RecruitmentErrorCode =
  | "notFound"
  | "invalidTitle"
  | "invalidOpenings"
  | "invalidSalary"
  | "invalidReason"
  | "invalidTransition"
  | "notEditable"
  | "notOpen"
  | "invalidName"
  | "invalidContact"
  | "invalidEmail"
  | "invalidFin"
  | "invalidSource"
  | "alreadyApplied"
  | "invalidStage"
  | "alreadyFinal"
  | "sameStage"
  | "reasonRequired"
  | "invalidNote"

export class RecruitmentError extends Error {
  constructor(public readonly code: RecruitmentErrorCode) {
    super(code)
  }
}

const REQUISITION_ERRORS = {
  title: "invalidTitle",
  openings: "invalidOpenings",
  salary: "invalidSalary",
  reason: "invalidReason",
} as const

const CANDIDATE_ERRORS = {
  name: "invalidName",
  contact: "invalidContact",
  email: "invalidEmail",
  fin: "invalidFin",
  source: "invalidSource",
} as const

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------

async function nextRequisitionCode(client: PrismaClientOrTransaction): Promise<string> {
  const last = await client.jobRequisition.findFirst({ orderBy: { code: "desc" }, select: { code: true } })
  const lastNumber = last ? Number(last.code.replace(/\D/g, "")) : 0
  return `VAC-${String(lastNumber + 1).padStart(4, "0")}`
}

function requisitionData(input: RequisitionInput) {
  return {
    title: input.title.trim(),
    departmentId: input.departmentId || null,
    branchId: input.branchId || null,
    openings: input.openings,
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    reason: input.reason,
    description: (input.description ?? "").trim(),
  }
}

export async function createRequisition(input: RequisitionInput): Promise<{ id: string; code: string }> {
  const invalid = validateRequisitionInput(input)
  if (invalid) throw new RecruitmentError(REQUISITION_ERRORS[invalid])
  return prisma.$transaction(async (tx) => {
    const code = await nextRequisitionCode(tx)
    const created = await tx.jobRequisition.create({ data: { code, ...requisitionData(input) } })
    await tx.recruitmentStatusEvent.create({
      data: { requisitionId: created.id, fromStatus: "", toStatus: "DRAFT" },
    })
    return { id: created.id, code }
  })
}

export async function updateRequisition(id: string, input: RequisitionInput): Promise<void> {
  const invalid = validateRequisitionInput(input)
  if (invalid) throw new RecruitmentError(REQUISITION_ERRORS[invalid])
  const existing = await prisma.jobRequisition.findUnique({ where: { id } })
  if (!existing) throw new RecruitmentError("notFound")
  if (!isRequisitionEditable(existing.status as RequisitionStatus)) throw new RecruitmentError("notEditable")
  await prisma.jobRequisition.update({ where: { id }, data: requisitionData(input) })
}

export async function transitionRequisition(id: string, to: RequisitionStatus, note = ""): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.jobRequisition.findUnique({ where: { id } })
    if (!existing) throw new RecruitmentError("notFound")
    const from = existing.status as RequisitionStatus
    if (!canTransitionRequisition(from, to)) throw new RecruitmentError("invalidTransition")
    await tx.jobRequisition.update({ where: { id }, data: { status: to } })
    await tx.recruitmentStatusEvent.create({
      data: { requisitionId: id, fromStatus: from, toStatus: to, note: note.trim() },
    })
  })
}

export function listRequisitions() {
  return prisma.jobRequisition.findMany({
    orderBy: { createdAt: "desc" },
    include: { applications: { select: { stage: true } } },
  })
}

export function getRequisitionDetail(id: string) {
  return prisma.jobRequisition.findUnique({
    where: { id },
    include: {
      applications: {
        orderBy: { stageUpdatedAt: "desc" },
        include: { candidate: true, notes: { orderBy: { createdAt: "desc" } } },
      },
    },
  })
}

export function listRequisitionEvents(requisitionId: string) {
  return prisma.recruitmentStatusEvent.findMany({ where: { requisitionId }, orderBy: { createdAt: "desc" } })
}

// ---------------------------------------------------------------------------
// Candidates and applications
// ---------------------------------------------------------------------------

export type AddCandidateResult =
  | { status: "created"; applicationId: string }
  | { status: "duplicates"; duplicates: Array<{ id: string; fullName: string; phone: string; email: string; finCode: string }> }

/**
 * Adds a candidate to an open vacancy. If someone with the same FİN, phone or
 * e-mail already exists, nothing is written and the matches are returned so the
 * user can pick one (pass `existingCandidateId`) or confirm a new person
 * (`confirmNew`).
 */
export async function addCandidateToRequisition(
  requisitionId: string,
  input: CandidateInput,
  options: { existingCandidateId?: string; confirmNew?: boolean } = {}
): Promise<AddCandidateResult> {
  return prisma.$transaction(async (tx) => {
    const requisition = await tx.jobRequisition.findUnique({ where: { id: requisitionId } })
    if (!requisition) throw new RecruitmentError("notFound")
    if (!acceptsApplications(requisition.status as RequisitionStatus)) throw new RecruitmentError("notOpen")

    let candidateId = options.existingCandidateId
    if (candidateId) {
      const exists = await tx.candidate.findUnique({ where: { id: candidateId } })
      if (!exists) throw new RecruitmentError("notFound")
    } else {
      const invalid = validateCandidateInput(input)
      if (invalid) throw new RecruitmentError(CANDIDATE_ERRORS[invalid])
      if (!options.confirmNew) {
        const all = await tx.candidate.findMany()
        const duplicates = findDuplicateCandidates(all, input)
        if (duplicates.length > 0) {
          return {
            status: "duplicates" as const,
            duplicates: duplicates.map((c) => ({
              id: c.id,
              fullName: `${c.lastName} ${c.firstName} ${c.fatherName}`.trim(),
              phone: c.phone,
              email: c.email,
              finCode: c.finCode,
            })),
          }
        }
      }
      const created = await tx.candidate.create({
        data: {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          fatherName: (input.fatherName ?? "").trim(),
          // Stored as typed; duplicate matching normalises both sides itself.
          phone: (input.phone ?? "").trim(),
          email: normalizeEmail(input.email),
          finCode: normalizeFin(input.finCode),
          source: input.source || "OTHER",
          notes: (input.notes ?? "").trim(),
        },
      })
      candidateId = created.id
    }

    const already = await tx.recruitmentApplication.findUnique({
      where: { candidateId_requisitionId: { candidateId, requisitionId } },
    })
    if (already) throw new RecruitmentError("alreadyApplied")
    const application = await tx.recruitmentApplication.create({ data: { candidateId, requisitionId } })
    return { status: "created" as const, applicationId: application.id }
  })
}

export async function moveApplication(applicationId: string, to: string, rejectionReason = ""): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const application = await tx.recruitmentApplication.findUnique({
      where: { id: applicationId },
      include: { requisition: true },
    })
    if (!application) throw new RecruitmentError("notFound")
    if (!acceptsApplications(application.requisition.status as RequisitionStatus)) throw new RecruitmentError("notOpen")

    const error = validateStageMove(application.stage as PipelineStage, to, rejectionReason)
    if (error) throw new RecruitmentError(error)
    if (!isPipelineStage(to)) throw new RecruitmentError("invalidStage")

    await tx.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        stage: to,
        stageUpdatedAt: new Date(),
        rejectionReason: to === "REJECTED" ? rejectionReason.trim() : "",
      },
    })

    // The vacancy is filled once enough people have been hired.
    if (to === "HIRED") {
      const hired = await tx.recruitmentApplication.count({
        where: { requisitionId: application.requisitionId, stage: "HIRED" },
      })
      if (hired >= application.requisition.openings) {
        await tx.jobRequisition.update({ where: { id: application.requisitionId }, data: { status: "FILLED" } })
        await tx.recruitmentStatusEvent.create({
          data: {
            requisitionId: application.requisitionId,
            fromStatus: "OPEN",
            toStatus: "FILLED",
            note: "auto: all openings filled",
          },
        })
      }
    }
  })
}

export async function addApplicationNote(
  applicationId: string,
  input: { kind: string; text: string; rating?: number | null }
): Promise<void> {
  const text = input.text.trim()
  const kind = input.kind === "INTERVIEW" ? "INTERVIEW" : "NOTE"
  const rating = input.rating ?? null
  if (!text || text.length > 2000) throw new RecruitmentError("invalidNote")
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new RecruitmentError("invalidNote")
  const application = await prisma.recruitmentApplication.findUnique({ where: { id: applicationId } })
  if (!application) throw new RecruitmentError("notFound")
  await prisma.recruitmentApplicationNote.create({
    data: { applicationId, kind, text, rating: kind === "INTERVIEW" ? rating : null },
  })
}

export function listCandidates() {
  return prisma.candidate.findMany({
    orderBy: { createdAt: "desc" },
    include: { applications: { include: { requisition: { select: { id: true, code: true, title: true } } } } },
  })
}
