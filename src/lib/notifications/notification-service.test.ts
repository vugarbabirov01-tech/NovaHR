import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import {
  listNotifications,
  markNotificationRead,
  notify,
} from "@/lib/notifications/notification-service"

const MARK = "test-notification-service"

afterEach(async () => {
  await prisma.notification.deleteMany({ where: { entityType: MARK } })
})

describe("notification service", () => {
  it("records a notification as unread with its params and link", async () => {
    await notify({ type: "recruitment.vacancy", params: { title: "Operator", code: "VAC-1" }, href: "/recruitment/x", entityType: MARK })
    const { items } = await listNotifications()
    const created = items.find((item) => item.href === "/recruitment/x")
    expect(created).toMatchObject({ type: "recruitment.vacancy", params: { title: "Operator", code: "VAC-1" }, read: false })
  })

  it("marks a notification as read", async () => {
    await notify({ type: "payroll.status", params: { year: 2026, month: 11, status: "PAID" }, href: "/payroll-test", entityType: MARK })
    const created = (await listNotifications()).items.find((item) => item.href === "/payroll-test")!
    expect(created.read).toBe(false)
    await markNotificationRead(created.id)
    expect((await listNotifications()).items.find((item) => item.id === created.id)?.read).toBe(true)
  })
})
