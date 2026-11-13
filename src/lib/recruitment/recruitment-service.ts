import { getFullLegalName } from "@/lib/employees"
import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import { buildReplacementRequisition } from "@/lib/recruitment/replacement-vacancy"
import { findAllDepartments } from "@/repositories/department-repository"
import { findAllEmployees, findEmployeeById } from "@/repositories/employee-repository"
import {
  acceptsApplications,
  canStartHire,
  canTransitionOffer,
  canTransitionRequisition,
  findDuplicateCandidates,
  isOfferEditable,
  isPipelineStage,
  isRequisitionEditable,
  normalizeEmail,
  normalizeFin,
  validateCandidateInput,
  validateOfferInput,
  validateRequisitionInput,
  validateStageMove,
  type CandidateInput,
  type OfferInput,
  type OfferStatus,
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
  | "invalidSalary"
  | "invalidStartDate"
  | "offerNotAllowed"
  | "offerLocked"
  | "noOffer"
  | "useHireFlow"
  | "notTerminated"
  | "cannotHire"

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
        include: { candidate: true, offer: true, notes: { orderBy: { createdAt: "desc" } } },
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

// ---------------------------------------------------------------------------
// Offers and hiring
// ---------------------------------------------------------------------------

const OFFER_ERRORS = { salary: "invalidSalary", startDate: "invalidStartDate", note: "invalidNote" } as const

/** Creates or updates the application's offer. Allowed only at the OFFER stage, while the offer is a draft (or was declined). */
export async function saveOffer(applicationId: string, input: OfferInput): Promise<void> {
  const invalid = validateOfferInput(input)
  if (invalid) throw new RecruitmentError(OFFER_ERRORS[invalid])
  await prisma.$transaction(async (tx) => {
    const application = await tx.recruitmentApplication.findUnique({
      where: { id: applicationId },
      include: { requisition: true, offer: true },
    })
    if (!application) throw new RecruitmentError("notFound")
    if (!acceptsApplications(application.requisition.status as RequisitionStatus)) throw new RecruitmentError("notOpen")
    if (application.stage !== "OFFER") throw new RecruitmentError("offerNotAllowed")

    const data = { salary: Math.round(input.salary * 100) / 100, startDate: input.startDate, note: (input.note ?? "").trim() }
    if (!application.offer) {
      await tx.recruitmentOffer.create({ data: { applicationId, ...data } })
      return
    }
    const status = application.offer.status as OfferStatus
    if (!isOfferEditable(status)) throw new RecruitmentError("offerLocked")
    // Revising a declined offer reopens it as a draft.
    await tx.recruitmentOffer.update({
      where: { applicationId },
      data: { ...data, status: "DRAFT", sentAt: null, respondedAt: null },
    })
  })
}

export async function transitionOffer(applicationId: string, to: OfferStatus): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const application = await tx.recruitmentApplication.findUnique({
      where: { id: applicationId },
      include: { requisition: true, offer: true },
    })
    if (!application) throw new RecruitmentError("notFound")
    if (!application.offer) throw new RecruitmentError("noOffer")
    if (!acceptsApplications(application.requisition.status as RequisitionStatus)) throw new RecruitmentError("notOpen")
    if (!canTransitionOffer(application.offer.status as OfferStatus, to)) throw new RecruitmentError("invalidTransition")

    const now = new Date()
    await tx.recruitmentOffer.update({
      where: { applicationId },
      data: {
        status: to,
        sentAt: to === "SENT" ? now : to === "DRAFT" ? null : undefined,
        respondedAt: to === "ACCEPTED" || to === "DECLINED" ? now : to === "DRAFT" ? null : undefined,
      },
    })
  })
}

/** Everything the hire page needs; throws unless the application is ready to be hired. */
export async function getHireContext(applicationId: string) {
  const application = await prisma.recruitmentApplication.findUnique({
    where: { id: applicationId },
    include: { candidate: true, requisition: true, offer: true },
  })
  if (!application) throw new RecruitmentError("notFound")
  if (!acceptsApplications(application.requisition.status as RequisitionStatus)) throw new RecruitmentError("notOpen")
  if (!canStartHire(application.stage as PipelineStage, (application.offer?.status as OfferStatus | undefined) ?? null)) {
    throw new RecruitmentError("cannotHire")
  }
  return application
}

/**
 * Called once the employee record exists: marks the application HIRED, links
 * the employee, and closes the vacancy as FILLED when every opening is taken.
 */
export async function completeHire(applicationId: string, employeeId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const application = await tx.recruitmentApplication.findUnique({
      where: { id: applicationId },
      include: { requisition: true, offer: true },
    })
    if (!application) throw new RecruitmentError("notFound")
    if (!canStartHire(application.stage as PipelineStage, (application.offer?.status as OfferStatus | undefined) ?? null)) {
      throw new RecruitmentError("cannotHire")
    }

    await tx.recruitmentApplication.update({
      where: { id: applicationId },
      data: { stage: "HIRED", hiredEmployeeId: employeeId, stageUpdatedAt: new Date() },
    })

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
  })
}

// ---------------------------------------------------------------------------
// Vacant places (employees who left)
// ---------------------------------------------------------------------------

/**
 * Opens a draft REPLACEMENT vacancy for an employee who has left: same
 * position, department and branch. Idempotent: if a vacancy already replaces
 * this employee it is returned unchanged.
 */
export async function createReplacementVacancy(
  employeeId: string
): Promise<{ id: string; code: string; created: boolean }> {
  const employee = await findEmployeeById(employeeId)
  if (!employee) throw new RecruitmentError("notFound")
  if (employee.employmentStatus !== "terminated") throw new RecruitmentError("notTerminated")

  const departments = await findAllDepartments()
  const input = buildReplacementRequisition(employee, departments)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.jobRequisition.findFirst({ where: { replacesEmployeeId: employeeId } })
    if (existing) return { id: existing.id, code: existing.code, created: false }

    const code = await nextRequisitionCode(tx)
    const created = await tx.jobRequisition.create({
      data: { code, ...requisitionData(input), replacesEmployeeId: employeeId },
    })
    await tx.recruitmentStatusEvent.create({
      data: { requisitionId: created.id, fromStatus: "", toStatus: "DRAFT", note: "auto: employee left" },
    })
    return { id: created.id, code, created: true }
  })
}

export interface VacantPlace {
  employeeId: string
  fullName: string
  employeeNumber: string
  position: string
  department: string
  /** yyyy-mm-dd of the termination event, when recorded */
  leftOn: string
}

/** Employees who left and have no replacement vacancy yet (safety net for the automatic flow and for older departures). */
export async function listVacantPlaces(): Promise<VacantPlace[]> {
  const [employees, linked] = await Promise.all([
    findAllEmployees(),
    prisma.jobRequisition.findMany({ where: { replacesEmployeeId: { not: null } }, select: { replacesEmployeeId: true } }),
  ])
  const covered = new Set(linked.map((row) => row.replacesEmployeeId))
  return employees
    .filter((employee) => employee.employmentStatus === "terminated" && !covered.has(employee.id))
    .map((employee) => ({
      employeeId: employee.id,
      fullName: getFullLegalName(employee.personal),
      employeeNumber: employee.employment.employeeNumber,
      position: employee.employment.position,
      department: employee.employment.department,
      leftOn: [...employee.employment.history].reverse().find((event) => event.type === "termination")?.date ?? "",
    }))
    .sort((a, b) => b.leftOn.localeCompare(a.leftOn))
}
