"use client"

import { Suspense, type ComponentProps } from "react"
import { Loader2 } from "lucide-react"

import { EmployeeProfileTabs } from "@/components/employees/profile/employee-profile-tabs"
import { ProfileHeader } from "@/components/employees/profile/profile-header"

type ProfileViewProps = ComponentProps<typeof ProfileHeader> & ComponentProps<typeof EmployeeProfileTabs>

/**
 * The profile page's layout. It lives in a client component on purpose: when the
 * server page itself wrapped these two in a <div>, React re-ran hydration of that
 * element while its streamed children were still loading and reported false
 * mismatches (the "1 Issue" badge on every direct load in development).
 */
export function ProfileView({ workStatus, backHref, penalty, ...tabs }: ProfileViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader profile={tabs.profile} workStatus={workStatus} backHref={backHref} penalty={penalty} />
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
          </div>
        }
      >
        <EmployeeProfileTabs {...tabs} />
      </Suspense>
    </div>
  )
}
