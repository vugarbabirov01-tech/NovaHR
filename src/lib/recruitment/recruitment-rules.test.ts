import { describe, expect, it } from "vitest"

import {
  acceptsApplications,
  canStartHire,
  canTransitionOffer,
  canTransitionRequisition,
  findDuplicateCandidates,
  isOfferEditable,
  isRequisitionEditable,
  normalizePhone,
  validateCandidateInput,
  validateOfferInput,
  validateRequisitionInput,
  validateStageMove,
} from "@/lib/recruitment/recruitment-rules"

describe("requisition status flow", () => {
  it("follows draft -> approval -> open -> filled/closed", () => {
    expect(canTransitionRequisition("DRAFT", "PENDING_APPROVAL")).toBe(true)
    expect(canTransitionRequisition("PENDING_APPROVAL", "OPEN")).toBe(true)
    expect(canTransitionRequisition("OPEN", "FILLED")).toBe(true)
    expect(canTransitionRequisition("CLOSED", "OPEN")).toBe(true)
  })

  it("blocks skipping approval and leaving a final state", () => {
    expect(canTransitionRequisition("DRAFT", "OPEN")).toBe(false)
    expect(canTransitionRequisition("FILLED", "OPEN")).toBe(false)
    expect(canTransitionRequisition("REJECTED", "OPEN")).toBe(false)
  })

  it("allows editing only before approval and applications only while open", () => {
    expect(isRequisitionEditable("DRAFT")).toBe(true)
    expect(isRequisitionEditable("REJECTED")).toBe(true)
    expect(isRequisitionEditable("OPEN")).toBe(false)
    expect(acceptsApplications("OPEN")).toBe(true)
    expect(acceptsApplications("PENDING_APPROVAL")).toBe(false)
  })
})

describe("pipeline stage moves", () => {
  it("allows normal forward and backward moves", () => {
    expect(validateStageMove("NEW", "SCREENING")).toBeNull()
    expect(validateStageMove("INTERVIEW", "SCREENING")).toBeNull()
    expect(validateStageMove("OFFER", "INTERVIEW")).toBeNull()
  })

  it("never allows a plain move to HIRED (the hire flow does that)", () => {
    expect(validateStageMove("OFFER", "HIRED")).toBe("useHireFlow")
    expect(validateStageMove("NEW", "HIRED")).toBe("useHireFlow")
  })

  it("requires a reason to reject and blocks final or unchanged stages", () => {
    expect(validateStageMove("NEW", "REJECTED")).toBe("reasonRequired")
    expect(validateStageMove("NEW", "REJECTED", "  ")).toBe("reasonRequired")
    expect(validateStageMove("NEW", "REJECTED", "Uyğun deyil")).toBeNull()
    expect(validateStageMove("HIRED", "NEW")).toBe("alreadyFinal")
    expect(validateStageMove("REJECTED", "NEW")).toBe("alreadyFinal")
    expect(validateStageMove("NEW", "NEW")).toBe("sameStage")
    expect(validateStageMove("NEW", "BOGUS")).toBe("invalidStage")
  })
})

describe("input validation", () => {
  it("validates a vacancy", () => {
    const base = { title: "Mühasib", openings: 1, reason: "NEW_POSITION" }
    expect(validateRequisitionInput(base)).toBeNull()
    expect(validateRequisitionInput({ ...base, title: " " })).toBe("title")
    expect(validateRequisitionInput({ ...base, openings: 0 })).toBe("openings")
    expect(validateRequisitionInput({ ...base, reason: "X" })).toBe("reason")
    expect(validateRequisitionInput({ ...base, salaryMin: 900, salaryMax: 800 })).toBe("salary")
    expect(validateRequisitionInput({ ...base, salaryMin: 800, salaryMax: 900 })).toBeNull()
  })

  it("validates a candidate: name, one contact, e-mail and FİN format", () => {
    expect(validateCandidateInput({ firstName: "Ali", lastName: "Əliyev", phone: "050 123 45 67" })).toBeNull()
    expect(validateCandidateInput({ firstName: "", lastName: "Əliyev", phone: "0501234567" })).toBe("name")
    expect(validateCandidateInput({ firstName: "Ali", lastName: "Əliyev" })).toBe("contact")
    expect(validateCandidateInput({ firstName: "Ali", lastName: "Əliyev", email: "bad" })).toBe("email")
    expect(validateCandidateInput({ firstName: "Ali", lastName: "Əliyev", phone: "0501234567", finCode: "123" })).toBe("fin")
    expect(validateCandidateInput({ firstName: "Ali", lastName: "Əliyev", phone: "0501234567", finCode: "7c4nmc6" })).toBeNull()
  })
})

describe("duplicate detection", () => {
  const existing = [
    { id: "c1", phone: "0501234567", email: "a@x.az", finCode: "" },
    { id: "c2", phone: "", email: "", finCode: "7C4NMC6" },
  ]

  it("matches the same Azerbaijani phone in different formats", () => {
    expect(normalizePhone("+994 50 123 45 67")).toBe(normalizePhone("050-123-45-67"))
    expect(findDuplicateCandidates(existing, { firstName: "A", lastName: "B", phone: "+994501234567" }).map((c) => c.id)).toEqual(["c1"])
  })

  it("matches by e-mail (case-insensitive) and FİN", () => {
    expect(findDuplicateCandidates(existing, { firstName: "A", lastName: "B", email: "A@X.az" }).map((c) => c.id)).toEqual(["c1"])
    expect(findDuplicateCandidates(existing, { firstName: "A", lastName: "B", phone: "0559999999", finCode: "7c4nmc6" }).map((c) => c.id)).toEqual(["c2"])
  })

  it("does not match on empty fields", () => {
    expect(findDuplicateCandidates(existing, { firstName: "A", lastName: "B", phone: "0559999999" })).toEqual([])
  })
})

describe("offers", () => {
  it("follows draft -> sent -> accepted/declined, and a decline can be revised", () => {
    expect(canTransitionOffer("DRAFT", "SENT")).toBe(true)
    expect(canTransitionOffer("SENT", "ACCEPTED")).toBe(true)
    expect(canTransitionOffer("SENT", "DECLINED")).toBe(true)
    expect(canTransitionOffer("DECLINED", "DRAFT")).toBe(true)
    expect(canTransitionOffer("DRAFT", "ACCEPTED")).toBe(false)
    expect(canTransitionOffer("ACCEPTED", "DRAFT")).toBe(false)
  })

  it("is editable only as a draft or after a decline", () => {
    expect(isOfferEditable("DRAFT")).toBe(true)
    expect(isOfferEditable("DECLINED")).toBe(true)
    expect(isOfferEditable("SENT")).toBe(false)
    expect(isOfferEditable("ACCEPTED")).toBe(false)
  })

  it("validates salary, start date and note", () => {
    expect(validateOfferInput({ salary: 900, startDate: "2026-12-01" })).toBeNull()
    expect(validateOfferInput({ salary: 0, startDate: "2026-12-01" })).toBe("salary")
    expect(validateOfferInput({ salary: 900, startDate: "01.12.2026" })).toBe("startDate")
    expect(validateOfferInput({ salary: 900, startDate: "2026-13-45" })).toBe("startDate")
    expect(validateOfferInput({ salary: 900, startDate: "2026-12-01", note: "x".repeat(1001) })).toBe("note")
  })

  it("starts the hire flow only from OFFER with an accepted offer", () => {
    expect(canStartHire("OFFER", "ACCEPTED")).toBe(true)
    expect(canStartHire("OFFER", "SENT")).toBe(false)
    expect(canStartHire("OFFER", null)).toBe(false)
    expect(canStartHire("INTERVIEW", "ACCEPTED")).toBe(false)
  })
})
