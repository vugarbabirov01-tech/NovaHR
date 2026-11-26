// Imports experience data (ƏMAS official figure and periods, HR work-book total,
// actual start date) into ACTIVE Nova employees, matched by FİN.
//
// DRY-RUN BY DEFAULT: without --apply this only READS dev.db and writes a report
// workbook. --apply takes a dev.db backup first and writes in one transaction.
//
//   npx tsx scripts/import-experience.ts                        # dry-run
//   npx tsx scripts/import-experience.ts --only=FIN1,FIN2       # restrict
//   npx tsx scripts/import-experience.ts --apply --only=FIN1    # pilot write
//   npx tsx scripts/import-experience.ts --apply                # full write
//
// Options:
//   --hr=<path>     checked HR list (sheet "Sheet1")
//   --emas=<path>   ƏMAS export (sheet "Detallı dövrlər")
//   --out=<path>    report workbook

import "dotenv/config"

import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import * as XLSX from "xlsx"

import { cleanText } from "@/lib/emas-sync/parse"
import { getFullLegalName } from "@/lib/employees"
import {
  computeHrImport,
  formatSlashed,
  HR_COL,
  PERIOD_COL,
  type HrImportResult,
  type SheetRow,
} from "@/lib/experience/hr-import"
import { reviewReasons } from "@/lib/experience/work-experience"
import { prisma } from "@/lib/prisma"
import { updateEmployee } from "@/repositories/employee-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit?.slice(hit.indexOf("=") + 1)
}

const APPLY = process.argv.includes("--apply")
const HR_FILE = arg("hr") ?? join(homedir(), "Desktop", "noyabr (1) - yoxlanılmış.xlsx")
const EMAS_FILE = arg("emas") ?? join(homedir(), "Desktop", "BAKI_ABADLIQ_XIDMETI_staj_ve_kadr_2026-11-24.xlsx")
const OUT = arg("out") ?? "analysis/staj-idxali-hesabati.xlsx"
const ONLY = arg("only")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)

const REASON_TEXT = {
  bothSources: "Həm ƏMAS, həm kitabça stajı",
  likelyDuplicate: "TƏKRAR ŞÜBHƏSİ",
  informalPeriod: "Rəsmiləşməmiş dövrə uyğun fərq",
  bookOnly: "Staj yalnız kitabçada",
} as const

function readSheet(file: string, sheet: string, required: string[]): SheetRow[] {
  if (!existsSync(file)) throw new Error(`Fayl tapılmadı: ${file}`)
  const ws = XLSX.readFile(file).Sheets[sheet]
  if (!ws) throw new Error(`"${sheet}" vərəqi yoxdur: ${file}`)
  const header = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] ?? []
  const missing = required.filter((name) => !header.includes(name))
  if (missing.length) throw new Error(`Sütun yoxdur (${sheet}): ${missing.join(", ")}`)
  return XLSX.utils.sheet_to_json<SheetRow>(ws, { defval: null })
}

const finOf = (value: SheetRow[string]) => cleanText(value)?.toUpperCase()

async function main() {
  const hrRows = readSheet(HR_FILE, "Sheet1", Object.values(HR_COL))
  const periodRows = readSheet(EMAS_FILE, "Detallı dövrlər", Object.values(PERIOD_COL))

  const hrByFin = new Map<string, SheetRow>()
  for (const row of hrRows) {
    const fin = finOf(row[HR_COL.fin])
    if (!fin) continue
    if (hrByFin.has(fin)) throw new Error(`HR faylında FİN təkrarlanır: ${fin}`)
    hrByFin.set(fin, row)
  }
  const periodsByFin = new Map<string, SheetRow[]>()
  for (const row of periodRows) {
    const fin = finOf(row[PERIOD_COL.fin])
    if (fin) periodsByFin.set(fin, [...(periodsByFin.get(fin) ?? []), row])
  }

  const dbRows = await prisma.employee.findMany()
  const active = dbRows
    .map((r) => r.data as unknown as EmployeeProfile)
    .filter((e) => e.employmentStatus === "active")
    .filter((e) => !ONLY || ONLY.includes(e.personal.finCode.toUpperCase()))

  const now = new Date()
  const results: { before: EmployeeProfile; result: HrImportResult }[] = []
  const notFound: EmployeeProfile[] = []
  for (const employee of active) {
    const fin = employee.personal.finCode.toUpperCase()
    const row = hrByFin.get(fin)
    if (!row) {
      notFound.push(employee)
      continue
    }
    results.push({ before: employee, result: computeHrImport(employee, row, periodsByFin.get(fin) ?? [], now) })
  }
  const changed = results.filter((r) => r.result.changes.length > 0)

  const count = (test: (r: (typeof results)[number]) => boolean) => results.filter(test).length
  const reasonCount = (reason: keyof typeof REASON_TEXT) =>
    count((r) => r.result.profile.labourLaw.workBook?.status === "pending" && reviewReasons(r.result.profile, now).includes(reason))
  const summary: [string, string | number][] = [
    ["Rejim", APPLY ? "YAZILDI" : "SINAQ (heç nə yazılmayıb)"],
    ["Aktiv əməkdaş", active.length],
    ["HR faylında tapılan", results.length],
    ["Tapılmayan (toxunulmur)", notFound.length],
    ["Dəyişəcək əməkdaş", changed.length],
    ["Faktiki başlama yazılacaq", count((r) => r.result.changes.some((c) => c.field === "employment.actualStartDate"))],
    ["Rəsmi (ƏMAS) staj yazılacaq", count((r) => r.result.changes.some((c) => c.field === "labourLaw.officialPreviousExperience"))],
    ["Hesablamadakı staj dəyişəcək", count((r) => r.result.changes.some((c) => c.field === "labourLaw.previousWorkExperience"))],
    ["Dəqiqləşdirmə gözləyəcək (kitabça)", count((r) => r.result.profile.labourLaw.workBook?.status === "pending")],
    ["  həm ƏMAS, həm kitabça stajı", reasonCount("bothSources")],
    ["  yalnız kitabçada", reasonCount("bookOnly")],
    ["  təkrar şübhəsi", reasonCount("likelyDuplicate")],
    ["  rəsmiləşməmiş dövrə uyğun fərq", reasonCount("informalPeriod")],
    ["Məzuniyyət günü ARTACAQ (indi)", count((r) => r.result.leaveDaysAfter > r.result.leaveDaysBefore)],
    ["Məzuniyyət günü AZALACAQ (indi)", count((r) => r.result.leaveDaysAfter < r.result.leaveDaysBefore)],
    ["HR təsdiq etsə əlavə artacaq", count((r) => (r.result.leaveDaysIfConfirmed ?? 0) > r.result.leaveDaysAfter)],
    ["Xəbərdarlığı olan əməkdaş", count((r) => r.result.warnings.length > 0)],
  ]

  const name = (e: EmployeeProfile) => getFullLegalName(e.personal)
  const people = results
    .map(({ before, result }) => {
      const after = result.profile
      const reasons = after.labourLaw.workBook?.status === "pending" ? reviewReasons(after, now) : []
      return {
        "İşçi ID": before.id,
        FİN: before.personal.finCode,
        "Ad, soyad": name(before),
        "İşə qəbul": after.employment.hireDate,
        "Faktiki başlama": after.employment.actualStartDate ?? "",
        "Staj indi (il/ay/gün)": formatSlashed(before.labourLaw.previousWorkExperience),
        "ƏMAS stajı": formatSlashed(after.labourLaw.officialPreviousExperience),
        "Staj idxaldan sonra": formatSlashed(after.labourLaw.previousWorkExperience),
        "Kitabça (gözləyir)": after.labourLaw.workBook?.status === "pending" ? formatSlashed(after.labourLaw.workBook.declaredTotal) : "",
        "Məzuniyyət indi": result.leaveDaysBefore,
        "Məzuniyyət idxaldan sonra": result.leaveDaysAfter,
        "HR təsdiq etsə": result.leaveDaysIfConfirmed ?? "",
        "Yoxlama səbəbi": reasons.map((r) => REASON_TEXT[r]).join("; "),
        Xəbərdarlıq: result.warnings.join("; "),
      }
    })
    // What needs eyes first: leave going down, then suspicious entries, then warnings.
    .sort(
      (a, b) =>
        Number(b["Məzuniyyət idxaldan sonra"] < b["Məzuniyyət indi"]) - Number(a["Məzuniyyət idxaldan sonra"] < a["Məzuniyyət indi"]) ||
        Number(b["Yoxlama səbəbi"].includes("TƏKRAR")) - Number(a["Yoxlama səbəbi"].includes("TƏKRAR")) ||
        Number(!!b.Xəbərdarlıq) - Number(!!a.Xəbərdarlıq)
    )

  const book = XLSX.utils.book_new()
  const add = (title: string, rows: object[], widths: number[]) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    ws["!cols"] = widths.map((wch) => ({ wch }))
    if (rows.length && ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] }
    XLSX.utils.book_append_sheet(book, ws, title)
  }
  add("Xülasə", summary.map(([k, v]) => ({ Göstərici: k, Say: v })), [46, 28])
  add("Əməkdaşlar", people, [12, 10, 34, 12, 14, 16, 12, 18, 18, 14, 22, 14, 40, 60])
  add(
    "Dəyişikliklər",
    changed.flatMap(({ before, result }) =>
      result.changes.map((c) => ({ FİN: before.personal.finCode, İşçi: name(before), Sahə: c.field, Köhnə: c.oldValue, Yeni: c.newValue }))
    ),
    [10, 34, 38, 22, 30]
  )
  add("Tapılmayan", notFound.map((e) => ({ "İşçi ID": e.id, FİN: e.personal.finCode, "Ad, soyad": name(e) })), [12, 10, 34])
  XLSX.writeFile(book, OUT)

  console.log(summary.map(([k, v]) => `${k}: ${v}`).join("\n"))
  console.log(`Hesabat: ${OUT}`)

  if (!APPLY) return
  mkdirSync("backups", { recursive: true })
  const backup = join("backups", `dev.db.before-experience-import-${now.toISOString().replace(/[:.]/g, "-")}`)
  copyFileSync("dev.db", backup)
  console.log(`Ehtiyat nüsxə: ${backup}`)
  await prisma.$transaction(
    async (tx) => {
      for (const { result } of changed) await updateEmployee(result.profile.id, result.profile, tx)
    },
    { timeout: 120_000 }
  )
  console.log(`Yazıldı: ${changed.length} əməkdaş`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
