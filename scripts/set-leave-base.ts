// Sets the base annual leave (labourLaw.annualBaseLeaveDays, e.g. 30 for office
// roles) for given employees, or migrates legacy data where the base had been
// carried in companyAdditionalLeaveDays. Seniority stays Nova's own Art. 116
// figure. Dry-run by default.
//
//   npx tsx scripts/set-leave-base.ts --base=30 --fins=60UJWLY,6AWE7XZ [--apply]
//   npx tsx scripts/set-leave-base.ts --migrate-legacy [--apply]

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

const SPECIAL_STATUS = ["Art. 119.1", "Art. 119.2", "Art. 120"]

async function main() {
  const apply = process.argv.includes("--apply")
  const migrate = process.argv.includes("--migrate-legacy")
  const base = Number(arg("base"))
  const fins = (arg("fins") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
  if (!migrate && (!Number.isFinite(base) || base < 21 || fins.length === 0)) {
    throw new Error("need --migrate-legacy, or --base=<days> and --fins=<list>")
  }

  const now = new Date()
  const rows = await prisma.employee.findMany()
  const planned: { id: string; profile: EmployeeProfile }[] = []

  for (const row of rows) {
    const fin = row.finCode.toUpperCase()
    const profile = structuredClone(row.data as unknown as EmployeeProfile)
    const oldExtra = profile.labourLaw.companyAdditionalLeaveDays ?? 0
    const oldBase = profile.labourLaw.annualBaseLeaveDays
    if (migrate ? oldExtra <= 0 || oldBase : !fins.includes(fin)) continue

    const before = resolveAnnualLeaveEntitlement(profile, now)
    if (before.components.some((c) => SPECIAL_STATUS.includes(c.article))) {
      console.log(`${fin}: special-status base, skipped`)
      continue
    }
    const statutory = resolveAnnualLeaveEntitlement(
      { ...profile, labourLaw: { ...profile.labourLaw, annualBaseLeaveDays: undefined } },
      now
    )
      .components.filter((c) => c.article === "Art. 114.2" || c.article === "Art. 114.3")
      .reduce((sum, c) => sum + c.days, 0)

    const newBase = migrate ? statutory + oldExtra : base
    profile.labourLaw.annualBaseLeaveDays = newBase
    if (migrate) profile.labourLaw.companyAdditionalLeaveDays = 0

    const after = resolveAnnualLeaveEntitlement(profile, now)
    const seniority = after.components.filter((c) => c.article === "Art. 116").reduce((s, c) => s + c.days, 0)
    profile.leave.annualLeaveEntitlement = after.totalDays - seniority
    profile.leave.additionalLeaveEntitlement = seniority
    profile.leave.remainingLeaveDays = Math.max(0, after.totalDays - (profile.leave.usedLeaveDays ?? 0))
    if (migrate && after.totalDays !== before.totalDays) {
      console.log(`${fin}: total would change ${before.totalDays} -> ${after.totalDays}, skipped`)
      continue
    }

    const stamp = now.toISOString()
    profile.auditLog = [
      ...(profile.auditLog ?? []),
      {
        id: `AUD-${profile.employment.employeeNumber}-LEAVEBASE-${stamp}`,
        timestamp: stamp,
        actor: "HR (leave base correction)",
        action: "leave.base-correction",
        field: "labourLaw.annualBaseLeaveDays",
        oldValue: String(oldBase ?? ""),
        newValue: String(newBase),
      },
    ]
    planned.push({ id: profile.id, profile })
    console.log(
      `${fin} ${getFullLegalName(profile.personal)} (${profile.employment.position}): ${before.totalDays} -> ${after.totalDays} ` +
        `(base ${newBase}${migrate ? `, company extra ${oldExtra} -> 0` : ""} + seniority ${seniority})`
    )
  }

  if (!apply) {
    console.log(`DRY-RUN: ${planned.length} employee(s), nothing written. Add --apply to write.`)
    return
  }
  mkdirSync("backups", { recursive: true })
  const backup = `backups/dev.db.pre-leave-base.${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}.bak`
  copyFileSync("dev.db", backup)
  console.log("backup:", backup)
  await prisma.$transaction(async (tx) => {
    for (const p of planned) await updateEmployee(p.id, p.profile, tx)
  })
  console.log(`applied: ${planned.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
