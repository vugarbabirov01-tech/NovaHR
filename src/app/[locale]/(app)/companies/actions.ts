"use server"

import { revalidatePath } from "next/cache"

import {
  archiveCompany as archiveCompanyRepo,
  createCompany as createCompanyRepo,
  restoreCompany as restoreCompanyRepo,
  updateCompany as updateCompanyRepo,
  type Company,
} from "@/repositories/company-repository"
import { companyInputSchema, idSchema } from "@/lib/validation/master-data"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateCompanies() {
  // Best-effort cache invalidation — kept out of the write's try/catch so a
  // revalidation hiccup can never get reported back as a failed write.
  try {
    revalidatePath("/[locale]/companies", "page")
    revalidatePath("/[locale]/branches", "page")
    revalidatePath("/[locale]/employees/new", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function createCompanyAction(input: unknown): Promise<MasterDataActionResult<Company>> {
  const parsed = companyInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let company: Company
  try {
    company = await createCompanyRepo(parsed.data)
  } catch {
    return { success: false, error: "Could not create company." }
  }
  revalidateCompanies()
  return { success: true, data: company }
}

export async function updateCompanyAction(id: string, input: unknown): Promise<MasterDataActionResult<Company>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = companyInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let company: Company
  try {
    company = await updateCompanyRepo(parsedId.data, parsed.data)
  } catch {
    return { success: false, error: "Could not update company." }
  }
  revalidateCompanies()
  return { success: true, data: company }
}

export async function archiveCompanyAction(id: string): Promise<MasterDataActionResult<Company>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let company: Company
  try {
    company = await archiveCompanyRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not archive company." }
  }
  revalidateCompanies()
  return { success: true, data: company }
}

export async function restoreCompanyAction(id: string): Promise<MasterDataActionResult<Company>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let company: Company
  try {
    company = await restoreCompanyRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not restore company." }
  }
  revalidateCompanies()
  return { success: true, data: company }
}
