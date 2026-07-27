// One-off seed script — run with `npx tsx prisma/seed.ts`.
// Populates the Administration master tables with realistic starter data.
// Safe to re-run: every row is upserted by its unique `code`.

import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../src/generated/prisma/client.ts"

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
