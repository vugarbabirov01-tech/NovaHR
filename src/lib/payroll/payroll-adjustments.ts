export type AdjustmentKind = "ADDITION" | "DEDUCTION"

export const ADDITION_CATEGORIES = ["bonus", "overtime", "allowance", "other"] as const
export const DEDUCTION_CATEGORIES = ["advance", "loan", "fine", "other"] as const

export type AdjustmentCategory = (typeof ADDITION_CATEGORIES)[number] | (typeof DEDUCTION_CATEGORIES)[number]

export function categoriesFor(kind: AdjustmentKind): readonly string[] {
  return kind === "ADDITION" ? ADDITION_CATEGORIES : DEDUCTION_CATEGORIES
}

export interface AdjustmentInput {
  kind: string
  category: string
  amount: number
  note?: string
}

/** Returns an error code, or null when the input is valid. */
export function validateAdjustment(input: AdjustmentInput): "kind" | "category" | "amount" | "note" | null {
  if (input.kind !== "ADDITION" && input.kind !== "DEDUCTION") return "kind"
  if (!categoriesFor(input.kind).includes(input.category)) return "category"
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1_000_000) return "amount"
  if ((input.note ?? "").length > 300) return "note"
  return null
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function sumAdjustments(adjustments: Array<{ kind: string; amount: number }>): {
  additions: number
  deductions: number
} {
  let additions = 0
  let deductions = 0
  for (const adjustment of adjustments) {
    if (adjustment.kind === "ADDITION") additions += adjustment.amount
    else if (adjustment.kind === "DEDUCTION") deductions += adjustment.amount
  }
  return { additions: round2(additions), deductions: round2(deductions) }
}
