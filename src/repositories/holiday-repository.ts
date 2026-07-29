import { prisma } from "@/lib/prisma"
import type { HolidayModel } from "@/generated/prisma/models"

export type { HolidayModel as Holiday }

export interface HolidayInput {
  name: string
  date: Date
  companyId?: string | null
  branchId?: string | null
  recurringAnnually?: boolean
}

export function findAllHolidays(): Promise<HolidayModel[]> {
  return prisma.holiday.findMany({ orderBy: { date: "asc" } })
}

export function findActiveHolidays(): Promise<HolidayModel[]> {
  return prisma.holiday.findMany({ where: { active: true }, orderBy: { date: "asc" } })
}

/** Plain date-range query — the data future Leave/Team/Holiday calendar
 * screens would read; no calendar rendering logic lives here. */
export function findHolidaysBetween(start: Date, end: Date): Promise<HolidayModel[]> {
  return prisma.holiday.findMany({
    where: { active: true, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  })
}

export function findHolidayById(id: string): Promise<HolidayModel | null> {
  return prisma.holiday.findUnique({ where: { id } })
}

export function createHoliday(input: HolidayInput): Promise<HolidayModel> {
  return prisma.holiday.create({
    data: {
      name: input.name,
      date: input.date,
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
      recurringAnnually: input.recurringAnnually ?? false,
    },
  })
}

export function updateHoliday(id: string, input: HolidayInput): Promise<HolidayModel> {
  return prisma.holiday.update({
    where: { id },
    data: {
      name: input.name,
      date: input.date,
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
      recurringAnnually: input.recurringAnnually ?? false,
    },
  })
}

export function archiveHoliday(id: string): Promise<HolidayModel> {
  return prisma.holiday.update({ where: { id }, data: { active: false } })
}

export function restoreHoliday(id: string): Promise<HolidayModel> {
  return prisma.holiday.update({ where: { id }, data: { active: true } })
}
