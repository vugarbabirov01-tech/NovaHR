// ƏMAS -> Nova employee sync.
//
// DRY-RUN BY DEFAULT: without --apply this script only READS dev.db and
// writes a report workbook. --apply takes a dev.db backup first and then
// writes everything in one transaction.
//
//   npx tsx scripts/emas-sync.ts                       # dry-run, all employees
//   npx tsx scripts/emas-sync.ts --only=FIN1,FIN2      # restrict to these FINs
//   npx tsx scripts/emas-sync.ts --apply --only=FIN1   # pilot write
//   npx tsx scripts/emas-sync.ts --apply               # full write
//
// Options:
//   --file=<path>     ƏMAS workbook (default: the 12.11.2026 export in Downloads)
//   --create=<FINs>   comma list of FINs missing from Nova that should be created
//                     (default: 7C4NMC6; pass --create= to create nobody)
//   --out=<path>      report workbook (default: analysis/emas-sync-report.xlsx)

import "dotenv/config"

import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import * as XLSX from "xlsx"

import {
  buildNewProfile,
  COL,
  computeSync,
  hasEmasContract,
  type EmasDetailRow,
  type EmasRow,
  type FieldChange,
} from "@/lib/emas-sync/compute-sync"
import { cleanText } from "@/lib/emas-sync/parse"
import { generateNextEmployeeNumber, getFullLegalName } from "@/lib/employees"
import { prisma } from "@/lib/prisma"
import { normalizeReferenceName } from "@/lib/reference-data/normalize-name"
import { createEmployee, updateEmployee } from "@/repositories/employee-repository"
import { createPosition } from "@/repositories/position-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (!hit) return undefined
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : ""
}

const APPLY = process.argv.includes("--apply")
const FILE = arg("file") ?? join(homedir(), "Downloads", "Kadr_bazasi_staj_ƏMAS_12.11.2026.xlsx")
const OUT = arg("out") ?? "analysis/emas-sync-report.xlsx"
const ONLY = arg("only")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const CREATE = (arg("create") ?? "7C4NMC6").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)

const SHEET_MAIN = "Əvvəlki staj"
const SHEET_DETAIL = "Detallı dövrlər"

interface Planned {
  id: string
  fin: string
  name: string
  profile: EmployeeProfile
  changes: FieldChange[]
  isNew: boolean
  leave?: { emasTotal: number; novaTotal: number }
}

async function main() {
  if (!existsSync(FILE)) throw new Error(`Workbook not found: ${FILE}`)
  const wb = XLSX.readFile(FILE)
  const rows = XLSX.utils.sheet_to_json<EmasRow>(wb.Sheets[SHEET_MAIN], { defval: null })
  const detailRows = XLSX.utils.sheet_to_json<EmasDetailRow>(wb.Sheets[SHEET_DETAIL], { defval: null })

  const detailsByFin = new Map<string, EmasDetailRow[]>()
  for (const d of detailRows) {
    const fin = cleanText(d["FİN"])?.toUpperCase()
    if (!fin) continue
    detailsByFin.set(fin, [...(detailsByFin.get(fin) ?? []), d])
  }

  const dbRows = await prisma.employee.findMany()
  const profilesByFin = new Map(dbRows.map((r) => [r.finCode.toUpperCase(), r.data as unknown as EmployeeProfile]))

  const excelByFin = new Map<string, EmasRow>()
  for (const r of rows) {
    const fin = cleanText(r[COL.fin])?.toUpperCase()
    if (fin) excelByFin.set(fin, r)
  }

  const now = new Date()
  const planned: Planned[] = []
  const noContract: string[] = []
  const unchanged: string[] = []
  const warnings: string[] = []
  const takenNumbers = dbRows.map((r) => (r.data as unknown as EmployeeProfile).employment.employeeNumber)

  for (const [fin, existing] of profilesByFin) {
    if (ONLY && !ONLY.includes(fin)) continue
    const row = excelByFin.get(fin)
    if (!row || !hasEmasContract(row)) {
      noContract.push(`${fin} ${getFullLegalName(existing.personal)}${row ? " (ƏMAS müqaviləsi yoxdur)" : " (Excel-də yoxdur)"}`)
      continue
    }
    const result = computeSync(existing, row, detailsByFin.get(fin) ?? [], now)
    if (result.changes.length === 0) {
      unchanged.push(fin)
      continue
    }
    planned.push({
      id: existing.id,
      fin,
      name: getFullLegalName(existing.personal),
      profile: result.profile,
      changes: result.changes,
      isNew: false,
      leave: result.leaveComparison,
    })
  }

  for (const fin of CREATE) {
    if (ONLY && !ONLY.includes(fin)) continue
    if (profilesByFin.has(fin)) {
      warnings.push(`${fin}: artıq Nova-da var, yaradılmır`)
      continue
    }
    const row = excelByFin.get(fin)
    if (!row || !hasEmasContract(row)) {
      warnings.push(`${fin}: Excel-də aktiv müqavilə tapılmadı, yaradılmır`)
      continue
    }
    const number = generateNextEmployeeNumber(takenNumbers)
    const built = buildNewProfile(row, detailsByFin.get(fin) ?? [], number, now)
    if (!built) {
      warnings.push(`${fin}: ad/cins müəyyən edilə bilmədi, yaradılmır`)
      continue
    }
    takenNumbers.push(number)
    planned.push({
      id: built.profile.id,
      fin,
      name: getFullLegalName(built.profile.personal),
      profile: built.profile,
      changes: built.changes,
      isNew: true,
      leave: built.leaveComparison,
    })
  }

  // Positions that must exist in the Position catalog (title is unique per department).
  const departments = await prisma.department.findMany()
  const positions = await prisma.position.findMany()
  const needed = new Map<string, { departmentId: string; title: string }>()
  for (const p of planned) {
    const title = p.profile.employment.position
    if (!title) continue
    const dept = departments.find(
      (d) => normalizeReferenceName(d.name) === normalizeReferenceName(p.profile.employment.department)
    )
    if (!dept) {
      warnings.push(`${p.fin}: "${title}" üçün şöbə tapılmadı ("${p.profile.employment.department}") — vəzifə kataloqa əlavə olunmur`)
      continue
    }
    const exists = positions.some(
      (x) => x.departmentId === dept.id && normalizeReferenceName(x.title) === normalizeReferenceName(title)
    )
    if (!exists) needed.set(`${dept.id}|${normalizeReferenceName(title)}`, { departmentId: dept.id, title })
  }

  // ---- report ----
  const out = XLSX.utils.book_new()
  const fieldCounts = new Map<string, number>()
  planned.forEach((p) => p.changes.forEach((c) => fieldCounts.set(c.field, (fieldCounts.get(c.field) ?? 0) + 1)))
  const summary = [
    { Göstərici: "Rejim", Dəyər: APPLY ? "APPLY" : "DRY-RUN" },
    { Göstərici: "Yenilənəcək işçi", Dəyər: planned.filter((p) => !p.isNew).length },
    { Göstərici: "Yaradılacaq işçi", Dəyər: planned.filter((p) => p.isNew).length },
    { Göstərici: "Dəyişiklik olmayan işçi", Dəyər: unchanged.length },
    { Göstərici: "Toxunulmayan (müqavilə/Excel yoxdur)", Dəyər: noContract.length },
    { Göstərici: "Kataloqa əlavə olunacaq vəzifə", Dəyər: needed.size },
    { Göstərici: "Məzuniyyət cəmi ƏMAS-dan fərqli", Dəyər: planned.filter((p) => p.leave && p.leave.emasTotal !== p.leave.novaTotal).length },
    ...[...fieldCounts].sort().map(([k, v]) => ({ Göstərici: `sahə: ${k}`, Dəyər: v })),
  ]
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(summary), "Xülasə")
  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet(
      planned.flatMap((p) =>
        p.changes.map((c) => ({ FİN: p.fin, İşçi: p.name, Yeni: p.isNew ? "bəli" : "", Sahə: c.field, Köhnə: c.oldValue, Yeni_dəyər: c.newValue }))
      )
    ),
    "Dəyişikliklər"
  )
  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet([...needed.values()].map((n) => ({ Vəzifə: n.title, ŞöbəId: n.departmentId }))),
    "Yeni vəzifələr"
  )
  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet([...noContract.map((v) => ({ Toxunulmayan: v })), ...warnings.map((v) => ({ Xəbərdarlıq: v }))]),
    "Toxunulmayanlar"
  )
  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet(
      planned
        .filter((p) => p.leave && p.leave.emasTotal !== p.leave.novaTotal)
        .map((p) => ({ FİN: p.fin, İşçi: p.name, ƏMAS_cəmi: p.leave!.emasTotal, Nova_cəmi: p.leave!.novaTotal, Fərq: p.leave!.novaTotal - p.leave!.emasTotal }))
    ),
    "Məzuniyyət fərqləri"
  )
  mkdirSync("analysis", { recursive: true })
  XLSX.writeFile(out, OUT)

  console.log(`${APPLY ? "APPLY" : "DRY-RUN"} | update=${planned.filter((p) => !p.isNew).length} create=${planned.filter((p) => p.isNew).length} unchanged=${unchanged.length} untouched=${noContract.length} newPositions=${needed.size}`)
  console.log([...fieldCounts].sort().map(([k, v]) => `  ${k}: ${v}`).join("\n"))
  warnings.forEach((w) => console.log("WARN", w))
  console.log(`Report: ${OUT}`)

  if (!APPLY) {
    console.log("Dry-run: nothing was written to the database.")
    return
  }

  // ---- apply ----
  const url = process.env.DATABASE_URL ?? "file:./dev.db"
  if (url.startsWith("file:")) {
    mkdirSync("backups", { recursive: true })
    const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14)
    const backup = join("backups", `dev.db.pre-emas-sync.${stamp}.bak`)
    copyFileSync(url.slice("file:".length), backup)
    console.log(`Backup: ${backup}`)
  } else {
    throw new Error("--apply refuses to run against a non-file database without a manual backup.")
  }

  await prisma.$transaction(
    async (tx) => {
      for (const n of needed.values()) await createPosition(n, tx)
      for (const p of planned) {
        if (p.isNew) await createEmployee(p.profile, tx)
        else await updateEmployee(p.id, p.profile, tx)
      }
    },
    { timeout: 120_000, maxWait: 30_000 }
  )
  console.log("Applied.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
