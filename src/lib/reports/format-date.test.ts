import { describe, expect, it } from "vitest"

import { formatReportDate } from "@/lib/reports/format-date"
import { getFullLegalName } from "@/lib/employees"

describe("formatReportDate", () => {
  it("renders ISO dates as gün.ay.il", () => {
    expect(formatReportDate("1954-05-15")).toBe("15.05.1954")
    expect(formatReportDate("2026-11-03T10:20:30.000Z")).toBe("03.11.2026")
  })
  it("leaves anything else unchanged", () => {
    expect(formatReportDate("15.05.1954")).toBe("15.05.1954")
    expect(formatReportDate("")).toBe("")
  })
})

describe("full name column", () => {
  it("is ordered Soyad Ad Ata adı", () => {
    expect(getFullLegalName({ lastName: "Fazilova", firstName: "Bahar", fatherName: "Ələsgər" })).toBe("Fazilova Bahar Ələsgər")
  })
})
