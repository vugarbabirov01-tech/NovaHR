// One-off seed script — run with `npx tsx prisma/seed.ts`.
// Populates the Administration master tables with realistic starter data.
// Safe to re-run: every row is upserted by its unique `code`.

import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../src/generated/prisma/client.ts"
import { seedEmployeeDirectory } from "../src/data/employee-directory.ts"

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" })
const prisma = new PrismaClient({ adapter })

async function main() {
  const companies = await Promise.all(
    [
      { code: "NGL", name: "Nova Group LLC" },
      { code: "NCL", name: "Nova Cleaning" },
      { code: "PLF", name: "PoolFix" },
    ].map((c) => prisma.company.upsert({ where: { code: c.code }, update: {}, create: c }))
  )
  const companyByCode = Object.fromEntries(companies.map((c) => [c.code, c]))

  await Promise.all(
    [
      { code: "NGL-HQ", name: "Baku HQ", companyCode: "NGL" },
      { code: "NGL-GJ", name: "Ganja Branch", companyCode: "NGL" },
      { code: "NGL-SM", name: "Sumgait Branch", companyCode: "NGL" },
      { code: "NGL-RMT", name: "Remote", companyCode: "NGL" },
      { code: "NCL-NRM", name: "Nərimanov", companyCode: "NCL" },
      { code: "NCL-BP", name: "Baku Palace", companyCode: "NCL" },
      { code: "NCL-OR", name: "Olympic Residence", companyCode: "NCL" },
      { code: "NCL-HO", name: "Head Office", companyCode: "NCL" },
      { code: "PLF-OFF", name: "PoolFix Office", companyCode: "PLF" },
      { code: "PLF-WH", name: "Warehouse", companyCode: "PLF" },
    ].map((b) =>
      prisma.branch.upsert({
        where: { code: b.code },
        update: {},
        create: { code: b.code, name: b.name, companyId: companyByCode[b.companyCode].id },
      })
    )
  )

  const departments = await Promise.all(
    [
      { code: "ENG", name: "Engineering" },
      { code: "DES", name: "Design" },
      { code: "SLS", name: "Sales" },
      { code: "FIN", name: "Finance" },
      { code: "HR", name: "Human Resources" },
      { code: "OPS", name: "Operations" },
      { code: "MKT", name: "Marketing" },
      { code: "LEG", name: "Legal" },
      { code: "CS", name: "Customer Success" },
      { code: "CLN", name: "Cleaning" },
      { code: "POOL", name: "Pool Services" },
    ].map((d) => prisma.department.upsert({ where: { code: d.code }, update: {}, create: d }))
  )
  const departmentByCode = Object.fromEntries(departments.map((d) => [d.code, d]))

  await Promise.all(
    [
      { code: "ENG-BE", title: "Backend Developer", deptCode: "ENG" },
      { code: "ENG-FE", title: "Frontend Developer", deptCode: "ENG" },
      { code: "ENG-DO", title: "DevOps", deptCode: "ENG" },
      { code: "ENG-MGR", title: "Engineering Manager", deptCode: "ENG" },
      { code: "FIN-CACC", title: "Chief Accountant", deptCode: "FIN" },
      { code: "FIN-ACC", title: "Accountant", deptCode: "FIN" },
      { code: "FIN-CASH", title: "Cashier", deptCode: "FIN" },
      { code: "HR-SPEC", title: "HR Specialist", deptCode: "HR" },
      { code: "HR-REC", title: "Recruiter", deptCode: "HR" },
      { code: "HR-MGR", title: "HR Manager", deptCode: "HR" },
      { code: "DES-SR", title: "Senior Product Designer", deptCode: "DES" },
      { code: "SLS-AE", title: "Account Executive", deptCode: "SLS" },
      { code: "MKT-SPEC", title: "Marketing Specialist", deptCode: "MKT" },
      { code: "LEG-COU", title: "Legal Counsel", deptCode: "LEG" },
      { code: "OPS-IT", title: "IT Support Specialist", deptCode: "OPS" },
      { code: "OPS-WH", title: "Warehouse Technician", deptCode: "OPS" },
      { code: "CS-SPEC", title: "Customer Success Specialist", deptCode: "CS" },
      { code: "CLN-CLR", title: "Cleaner", deptCode: "CLN" },
      { code: "CLN-SUP", title: "Cleaning Supervisor", deptCode: "CLN" },
      { code: "POOL-TECH", title: "Pool Technician", deptCode: "POOL" },
      { code: "POOL-MGR", title: "Pool Services Manager", deptCode: "POOL" },
    ].map((p) =>
      prisma.position.upsert({
        where: { code: p.code },
        update: {},
        create: { code: p.code, title: p.title, departmentId: departmentByCode[p.deptCode].id },
      })
    )
  )

  await Promise.all(
    ["G1", "G2", "G3", "G4", "G5", "G6", "G7"].map((code) =>
      prisma.grade.upsert({ where: { code }, update: {}, create: { code, name: code } })
    )
  )

  await Promise.all(
    [
      {
        code: "SCH-5D",
        label: "5 günlük iş həftəsi",
        description: "Əmək Məcəlləsinə uyğun standart 5 günlük iş həftəsi",
      },
      {
        code: "SCH-6D",
        label: "6 günlük iş həftəsi",
        description: "Əmək Məcəlləsinə uyğun standart 6 günlük iş həftəsi",
      },
      {
        code: "SCH-SHIFT",
        label: "Növbəli iş rejimi",
        description: "Növbə üzrə həyata keçirilən iş rejimi",
      },
      {
        code: "SCH-SUMMARIZED",
        label: "Cəmlənmiş iş vaxtının uçotu",
        description: "İş vaxtının müəyyən uçot dövrü ərzində cəmləşdirilərək hesablanması",
      },
      {
        code: "SCH-2448",
        label: "24/48 növbə rejimi",
        description: "24 saat iş, 48 saat istirahətdən ibarət xüsusi növbəli iş rejimi",
      },
      {
        code: "SCH-FLEX",
        label: "Elastik iş vaxtı",
        description: "İşçiyə iş vaxtının başlanğıc və bitmə saatlarını seçmə imkanı verən elastik iş rejimi",
      },
      {
        code: "SCH-CUSTOM",
        label: "Fərdi iş qrafiki",
        description: "İşəgötürən tərəfindən təsdiqlənmiş fərdi iş qrafiki",
      },
    ].map((s) =>
      prisma.workSchedule.upsert({
        where: { code: s.code },
        update: { label: s.label, description: s.description },
        create: s,
      })
    )
  )

  await Promise.all(
    [
      { code: "FULL-TIME", name: "Full-Time" },
      { code: "PART-TIME", name: "Part-Time" },
      { code: "SEASONAL", name: "Seasonal" },
      { code: "TEMPORARY", name: "Temporary" },
      { code: "CONTRACT", name: "Contract" },
      { code: "INTERNSHIP", name: "Internship" },
    ].map((e) => prisma.employmentType.upsert({ where: { code: e.code }, update: {}, create: e }))
  )

  // Leave Management — Phase 1-3B shipped the ledger/balance/policy-
  // resolution engine and the request wizard, but never real starter
  // LeaveTypes: with zero, the Employee Profile Leave tab's "Request Leave"
  // button had nothing to let HR pick from and was correctly disabled; with
  // only one (an earlier version of this seed), the dropdown couldn't
  // demonstrate that it genuinely lists every active type rather than a
  // single hardcoded choice. LeaveType.code is @unique, so each upserts the
  // same way every other master-data row above does. name/description are
  // Azerbaijani, matching this product's HR terminology — LeaveType.name
  // has no i18n structure (one plain field, unlike every UI label, which
  // goes through next-intl), so whatever language it's seeded in is what
  // every locale sees in the dropdown/cards/table. Each `update` clause
  // (unlike the empty `update: {}` used above for company/department/etc.)
  // deliberately re-applies name/description on every run, so correcting a
  // wording issue here and re-seeding always fixes an already-seeded row
  // too, not just a fresh database.
  //
  // entitlementUnitsPerYear is left null for every type except Annual: it
  // isn't read anywhere in application logic today (confirmed — Annual
  // Leave's own entitlement is independently computed by the Labour Code
  // engine in leave-policy-resolution-service.ts, not from this field), and
  // the other leave types don't have a rolling annual entitlement in the
  // same sense to begin with (social/paternity/sick are case-by-case,
  // statutorily-fixed or certificate-driven durations, not an annual
  // allowance) — so a number here would be decorative at best, misleading
  // at worst.
  //
  // Maternity/Paternity were retired from new leave requests (HR decision,
  // 2026) in favor of a single broader "Sosial Məzuniyyət" type — `active:
  // false` here (never a delete) is the same archive pattern
  // archiveDepartment/archiveLeaveType already use everywhere else:
  // findActiveLeaveTypes() (what the request wizard's dropdown reads) stops
  // offering them, but the rows themselves — and any LeaveRequest that
  // already references them — are untouched, so historical data keeps
  // resolving and displaying exactly as before. Listed last, after the five
  // still-offered types, purely for readability; array order here has no
  // effect on dropdown order (LEAVE_TYPE_DISPLAY_ORDER in
  // leave-request-details-step.tsx owns that).
  const leaveTypeDefinitions = [
    {
      code: "ANNUAL",
      name: "Əmək Məzuniyyəti",
      description:
        "Qanunla nəzərdə tutulmuş illik ödənişli əmək məzuniyyəti (Azərbaycan Respublikasının Əmək Məcəlləsi, 112-120-ci maddələr).",
      unit: "DAYS" as const,
      isPaid: true,
      requiresBalance: true,
      entitlementUnitsPerYear: 21,
      active: true,
    },
    {
      code: "UNPAID",
      name: "Ödənişsiz Məzuniyyət",
      description: "Əməkdaşın öz xahişi ilə verilən ödənişsiz məzuniyyət (Əmək Məcəlləsi, 128-ci maddə).",
      unit: "DAYS" as const,
      isPaid: false,
      requiresBalance: false,
      entitlementUnitsPerYear: null,
      active: true,
    },
    {
      code: "STUDY",
      name: "Təhsil Məzuniyyəti",
      description: "Təhsil müəssisəsində oxuyan əməkdaşlar üçün nəzərdə tutulmuş məzuniyyət (Əmək Məcəlləsi, 130-cu maddə).",
      unit: "DAYS" as const,
      isPaid: true,
      requiresBalance: true,
      entitlementUnitsPerYear: null,
      active: true,
    },
    {
      code: "SOCIAL",
      name: "Sosial Məzuniyyət",
      description: "Ailə vəziyyəti və digər sosial hallarla əlaqədar verilən qısamüddətli məzuniyyət (nikah, yaxın qohumun vəfatı və digər hallar).",
      unit: "DAYS" as const,
      isPaid: true,
      requiresBalance: false,
      entitlementUnitsPerYear: null,
      active: true,
    },
    {
      code: "SICK",
      name: "Xəstəlik Məzuniyyəti",
      description: "Əmək qabiliyyətinin müvəqqəti itirilməsi ilə əlaqədar məzuniyyət (tibbi arayış əsasında).",
      unit: "DAYS" as const,
      isPaid: true,
      requiresBalance: false,
      entitlementUnitsPerYear: null,
      active: true,
    },
    {
      code: "MATERNITY",
      name: "Analıq Məzuniyyəti",
      description: "Hamiləlik və doğuşla əlaqədar məzuniyyət (Əmək Məcəlləsi, 125-ci maddə).",
      unit: "DAYS" as const,
      isPaid: true,
      requiresBalance: false,
      entitlementUnitsPerYear: null,
      active: false,
    },
    {
      code: "PATERNITY",
      name: "Atalıq Məzuniyyəti",
      description: "Uşağın doğulması ilə əlaqədar ataya verilən qısamüddətli məzuniyyət.",
      unit: "DAYS" as const,
      isPaid: true,
      requiresBalance: false,
      entitlementUnitsPerYear: null,
      active: false,
    },
  ]

  for (const def of leaveTypeDefinitions) {
    const leaveType = await prisma.leaveType.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, active: def.active },
      create: {
        code: def.code,
        name: def.name,
        description: def.description,
        unit: def.unit,
        isPaid: def.isPaid,
        requiresBalance: def.requiresBalance,
        active: def.active,
      },
    })

    // LeavePolicy has no natural unique key (no code, no @@unique) to
    // upsert against, unlike every model above — find-then-create is the
    // correct idempotent equivalent here, not a workaround. companyId/
    // branchId left null (global default), matching the nullable-scope
    // convention every policy-resolution lookup in this codebase already
    // expects. balanceValidationMode is left at the schema's own "WARN"
    // default deliberately: with no opening balance imported yet, a
    // BLOCK-mode policy would leave every employee's balance at zero and
    // make the wizard's own Submit button unable to ever enable (see
    // leave-request-wizard.tsx) — WARN lets HR see the (accurate, zero)
    // balance without it being a wall.
    const existingPolicy = await prisma.leavePolicy.findFirst({
      where: { leaveTypeId: leaveType.id, companyId: null, branchId: null },
    })
    if (!existingPolicy) {
      await prisma.leavePolicy.create({
        data: {
          leaveTypeId: leaveType.id,
          effectiveFrom: new Date("2026-01-01"),
          entitlementUnitsPerYear: def.entitlementUnitsPerYear,
          requiresApproval: true,
          carryForwardAllowed: false,
          encashmentAllowed: false,
          balanceValidationMode: "WARN",
        },
      })
    }
  }

  // Employee used to live purely in memory (src/data/employee-directory.ts),
  // reset on every dev-server restart. Now that it's a real table, seed it
  // from that same original demo dataset the first time — upserted by `id`
  // like every other table above, so re-running this script never
  // duplicates or wipes out real employees a later import/create added.
  await Promise.all(
    seedEmployeeDirectory.map((employee) =>
      prisma.employee.upsert({
        where: { id: employee.id },
        update: {},
        create: {
          id: employee.id,
          finCode: employee.personal.finCode.trim().toUpperCase(),
          data: employee,
        },
      })
    )
  )

  console.log("Seed complete.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
