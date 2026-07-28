"use client"

import { useState, type ReactNode } from "react"

import { Sidebar } from "@/components/layout/sidebar"
import { MobileSidebar } from "@/components/layout/mobile-sidebar"
import { Header } from "@/components/layout/header"

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-svh w-full">
      <div className="print:hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <MobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  )
}
