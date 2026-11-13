// One-off: set the base annual leave (e.g. 30 for office roles) for given
// employees where the ƏMAS record carries 21. Same mechanism the ƏMAS sync
// uses: the extra days go in labourLaw.companyAdditionalLeaveDays, seniority
// stays Nova's own Art. 116 figure. Dry-run by default.
//
//   npx tsx scripts/set-leave-base.ts --base=30 --fins=60UJWLY,XXXXXXX
//   npx tsx scripts/set-leave-base.ts --base=30 --fins=... --apply

import "dotenv/config"

import { copyFileSync, mkdirSync } from "node:fs"

import { resolveAnnualLeaveEntitlement } from "@/lib/leave/leave-policy-resolution-service"
import { getFullLegalName } from "@/lib/employees"
import { prisma } from "@/lib/prisma"
import { updateEmployee } from "@/repositories/employee-repository"
import type { EmployeeProfile } from "@/types/employee-profile"

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit?.slice(hit.indexOf("=") + 1)
}

async function main() {
  const base = Number(arg("base"))
  const fins = (arg("fins") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
  const apply = process.argv.includes("--apply")
  if (!Number.isFinite(base) || base < 21 || fins.length === 0) throw new Error("need --base=<days> and --fins=<list>")

  const now = new Date()
  const rows = await prisma.employee.findMany()
  const planned: { id: string; label: string; profile: EmployeeProfile; before: string; after: string }[] = []

  for (const fin of fins) {
    const row = rows.find((r) => r.finCode.toUpperCase() === fin)
    if (!row) {
      console.log(`${fin}: not found`)
      continue
    }
    const profile = structuredClone(row.data as unknown as EmployeeProfile)
    const before = resolveAnnualLeaveEntitlement(profile, now)
    const baseDays = before.components
      .filter((c) => c.article === "Art. 114.2" || c.article === "Art. 114.3")
      .reduce((sum, c) => sum + c.days, 0)
    const statusBase = before.components.some((c) => ["Art. 119.1", "Art. 119.2", "Art. 120"].includes(c.article ?? ""))
    if (statusBase) {
      console.log(`${fin}: special-status base, skipped`)
      continue
    }
    const oldExtra = profile.labourLaw.companyAdditionalLeaveDays ?? 0
    profile.labourLaw.companyAdditionalLeaveDays = Math.max(0, base - baseDays)
    const after = resolveAnnualLeaveEntitlement(profile, now)
    const seniority = after.components.filter((c) => c.article === "Art. 116").reduce((s, c) => s + c.days, 0)
    profile.leave.annualLeaveEntitlement = after.totalDays - seniority
    profile.leave.additionalLeaveEntitlement = seniority
    profile.leave.remainingLeaveDays = Math.max(0, after.totalDays - (profile.leave.usedLeaveDays ?? 0))
    const stamp = now.toISOString()
    profile.auditLog = [
      ...(profile.auditLog ?? []),
      {
        id: `AUD-${profile.employment.employeeNumber}-LEAVEBASE-${stamp}`,
        timestamp: stamp,
        actor: "HR (leave base correction)",
        action: "leave.base-correction",
        field: "labourLaw.companyAdditionalLeaveDays",
        oldValue: String(oldExtra),
        newValue: String(profile.labourLaw.companyAdditionalLeaveDays),
      },
    ]
    const label = `${fin} ${getFullLegalName(profile.personal)} (${profile.employment.position})`
    planned.push({ id: profile.id, label, profile, before: `${before.totalDays}`, after: `${after.totalDays} (${after.totalDays - seniority}+${seniority})` })
    console.log(`${label}: ${before.totalDays} -> ${after.totalDays} (base ${after.totalDays - seniority} + seniority ${seniority})`)
  }

  if (!apply) {
    console.log("DRY-RUN: nothing written. Add --apply to write.")
    return
  }
  mkdirSync("backups", { recursive: true })
  const backup = `backups/dev.db.pre-leave-base.${stamp()}.bak`
  copyFileSync("dev.db", backup)
  console.log("backup:", backup)
  await prisma.$transaction(async (tx) => {
    for (const p of planned) await updateEmployee(p.id, p.profile, tx)
  })
  console.log(`applied: ${planned.length}`)
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
