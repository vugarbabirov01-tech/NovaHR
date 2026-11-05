import { prisma, type PrismaClientOrTransaction } from "@/lib/prisma"
import type { UserModel } from "@/generated/prisma/models"

export type { UserModel as User }

/**
 * Authentication Phase A — no Server Action/Component reads this yet.
 * email is stored lower-cased by convention (matched by createUser);
 * callers normalize before calling, same as finCode's uppercase
 * convention on employee-repository.ts.
 */
export interface CreateUserInput {
  email: string
  passwordHash: string
  fullName: string
  employeeId?: string | null
  mustChangePassword?: boolean
}

export function findUserByEmail(email: string, client: PrismaClientOrTransaction = prisma): Promise<UserModel | null> {
  return client.user.findUnique({ where: { email: email.trim().toLowerCase() } })
}

export function findUserById(id: string, client: PrismaClientOrTransaction = prisma): Promise<UserModel | null> {
  return client.user.findUnique({ where: { id } })
}

export function findUserByEmployeeId(employeeId: string, client: PrismaClientOrTransaction = prisma): Promise<UserModel | null> {
  return client.user.findUnique({ where: { employeeId } })
}

export function countActiveUsers(client: PrismaClientOrTransaction = prisma): Promise<number> {
  return client.user.count({ where: { active: true } })
}

export function createUser(input: CreateUserInput, client: PrismaClientOrTransaction = prisma): Promise<UserModel> {
  return client.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      employeeId: input.employeeId ?? null,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  })
}

export function setUserActive(id: string, active: boolean, client: PrismaClientOrTransaction = prisma): Promise<UserModel> {
  return client.user.update({ where: { id }, data: { active } })
}

export function markPasswordChanged(
  id: string,
  passwordHash: string,
  client: PrismaClientOrTransaction = prisma
): Promise<UserModel> {
  return client.user.update({ where: { id }, data: { passwordHash, mustChangePassword: false } })
}
