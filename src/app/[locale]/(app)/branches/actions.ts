"use server"

import { revalidatePath } from "next/cache"

import {
  archiveBranch as archiveBranchRepo,
  createBranch as createBranchRepo,
  restoreBranch as restoreBranchRepo,
  updateBranch as updateBranchRepo,
  type Branch,
} from "@/repositories/branch-repository"
import { branchInputSchema, idSchema } from "@/lib/validation/master-data"
import type { MasterDataActionResult } from "@/lib/actions/master-data-result"

function revalidateBranches() {
  // Best-effort cache invalidation — kept out of the write's try/catch so a
  // revalidation hiccup can never get reported back as a failed write.
  try {
    revalidatePath("/[locale]/branches", "page")
    revalidatePath("/[locale]/employees/new", "page")
  } catch {
    // Ignored — the write already succeeded regardless of revalidation.
  }
}

export async function createBranchAction(input: unknown): Promise<MasterDataActionResult<Branch>> {
  const parsed = branchInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  let branch: Branch
  try {
    branch = await createBranchRepo(parsed.data)
  } catch {
    return { success: false, error: "Could not create branch." }
  }
  revalidateBranches()
  return { success: true, data: branch }
}

export async function updateBranchAction(id: string, input: unknown): Promise<MasterDataActionResult<Branch>> {
  const parsedId = idSchema.safeParse(id)
  const parsed = branchInputSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid input." }
  }
  let branch: Branch
  try {
    branch = await updateBranchRepo(parsedId.data, parsed.data)
  } catch {
    return { success: false, error: "Could not update branch." }
  }
  revalidateBranches()
  return { success: true, data: branch }
}

export async function archiveBranchAction(id: string): Promise<MasterDataActionResult<Branch>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let branch: Branch
  try {
    branch = await archiveBranchRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not archive branch." }
  }
  revalidateBranches()
  return { success: true, data: branch }
}

export async function restoreBranchAction(id: string): Promise<MasterDataActionResult<Branch>> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { success: false, error: "Invalid id." }
  let branch: Branch
  try {
    branch = await restoreBranchRepo(parsedId.data)
  } catch {
    return { success: false, error: "Could not restore branch." }
  }
  revalidateBranches()
  return { success: true, data: branch }
}
