"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OverviewTab } from "@/components/employees/profile/overview-tab"
import { EmploymentTab } from "@/components/employees/profile/employment-tab"
import { PersonalTab } from "@/components/employees/profile/personal-tab"
import { LabourLawTab } from "@/components/employees/profile/labour-law-tab"
import { LeaveTab } from "@/components/employees/profile/leave-tab"
import { PayrollTab } from "@/components/employees/profile/payroll-tab"
import { DocumentsTab } from "@/components/employees/profile/documents-tab"
import { EducationTab } from "@/components/employees/profile/education-tab"
import { AssetsTab } from "@/components/employees/profile/assets-tab"
import { NotesTab } from "@/components/employees/profile/notes-tab"
import { AuditLogTab } from "@/components/employees/profile/audit-log-tab"
import type { EmployeeProfile } from "@/types/employee-profile"

interface EmployeeProfileTabsProps {
  profile: EmployeeProfile
}

const tabKeys = [
  "overview",
  "employment",
  "personal",
  "labourLaw",
  "leave",
  "payroll",
  "documents",
  "education",
  "assets",
  "notes",
  "auditLog",
] as const

type TabKey = (typeof tabKeys)[number]

function isTabKey(value: string | null): value is TabKey {
  return tabKeys.includes(value as TabKey)
}

export function EmployeeProfileTabs({ profile }: EmployeeProfileTabsProps) {
  const t = useTranslations("Employees.profile.tabs")
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")

  // Deep-linked from the Employee Card quick actions (?tab=payroll,
  // ?tab=documents, ?tab=leave) — falls back to "overview" for a plain
  // profile visit or an unrecognized value.
  const [activeTab, setActiveTab] = useState<TabKey>(
    isTabKey(requestedTab) ? requestedTab : "overview"
  )

  useEffect(() => {
    if (isTabKey(requestedTab)) setActiveTab(requestedTab)
  }, [requestedTab])

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
      <div className="overflow-x-auto">
        <TabsList variant="line" className="w-max min-w-full justify-start border-b border-border">
          {tabKeys.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(key)}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview">
        <OverviewTab profile={profile} />
      </TabsContent>
      <TabsContent value="employment">
        <EmploymentTab profile={profile} />
      </TabsContent>
      <TabsContent value="personal">
        <PersonalTab profile={profile} />
      </TabsContent>
      <TabsContent value="labourLaw">
        <LabourLawTab profile={profile} />
      </TabsContent>
      <TabsContent value="leave">
        <LeaveTab profile={profile} />
      </TabsContent>
      <TabsContent value="payroll">
        <PayrollTab profile={profile} />
      </TabsContent>
      <TabsContent value="documents">
        <DocumentsTab profile={profile} />
      </TabsContent>
      <TabsContent value="education">
        <EducationTab profile={profile} />
      </TabsContent>
      <TabsContent value="assets">
        <AssetsTab profile={profile} />
      </TabsContent>
      <TabsContent value="notes">
        <NotesTab profile={profile} />
      </TabsContent>
      <TabsContent value="auditLog">
        <AuditLogTab profile={profile} />
      </TabsContent>
    </Tabs>
  )
}
