import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { PayrollPeriodModel, PayrollEmployeeRecordModel } from "@/generated/prisma/models"

export type { PayrollPeriodModel as PayrollPeriod, PayrollEmployeeRecordModel as PayrollEmployeeRecord }

export function findPayrollPeriod(
  tenantId: string,
  year: number,
  month: number,
  client: PrismaClientOrTransaction = prisma
): Promise<PayrollPeriodModel | null> {
  return client.payrollPeriod.findUnique({ where: { tenantId_year_month: { tenantId, year, month } } })
}

export interface CreatePayrollPeriodInput {
  tenantId: string
  year: number
  month: number
  startDate: Date
  endDate: Date
}

export function createPayrollPeriod(
  input: CreatePayrollPeriodInput,
  client: PrismaClientOrTransaction = prisma
): Promise<PayrollPeriodModel> {
  return client.payrollPeriod.create({ data: input })
}

export function findPayrollEmployeeRecords(
  payrollPeriodId: string,
  client: PrismaClientOrTransaction = prisma
): Promise<PayrollEmployeeRecordModel[]> {
  return client.payrollEmployeeRecord.findMany({ where: { payrollPeriodId } })
}

export interface CreatePayrollEmployeeRecordInput {
  payrollPeriodId: string
  employeeId: string
  baseSalary: number
  currency: string
  additions: number
  deductions: number
  grossAmount: number
  netAmount: number
}

/** SQLite's createMany has no skipDuplicates (Postgres/MySQL only) — the
 * unique [payrollPeriodId, employeeId] index is still the hard backstop
 * against a genuine duplicate, it just surfaces as a thrown error here
 * instead of a silent skip. ensurePayrollPeriod already runs the
 * who's-missing check and this call inside one transaction, which is
 * enough to keep an ordinary request from racing itself. */
export function createPayrollEmployeeRecords(
  rows: CreatePayrollEmployeeRecordInput[],
  client: PrismaClientOrTransaction = prisma
): Promise<{ count: number }> {
  return client.payrollEmployeeRecord.createMany({ data: rows })
}
