/**
 * The one seam later payroll phases (income tax, DSMF, unemployment/medical
 * insurance, overtime, ...) extend — every caller reads a PayrollEmployeeRecord's
 * grossAmount/netAmount through these two functions rather than re-deriving
 * the formula, so a future engine only ever changes this file.
 */

export function computeGrossAmount(baseSalary: number, additions: number): number {
  return baseSalary + additions
}

export function computeNetAmount(grossAmount: number, deductions: number): number {
  return grossAmount - deductions
}
