"use client"

import { useTranslations } from "next-intl"
import { Mail, Phone } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EmploymentStatusBadge } from "@/components/employees/employment-status-badge"
import { EmployeeQuickActions } from "@/components/employees/EmployeeQuickActions"
import { calculateAgeFromDateOfBirth, getFullName, getInitials } from "@/lib/employees"
import type { EmployeeListItem } from "@/types/employee-profile"

interface EmployeeCardProps {
  employee: EmployeeListItem
  onEditEmployee?: (employee: { id: string; fullName: string }) => void
}

export function EmployeeCard({ employee, onEditEmployee }: EmployeeCardProps) {
  const t = useTranslations("Employees.card")
  const tTable = useTranslations("Employees.table")
  const fullName = getFullName(employee)

  return (
    <Card className="group relative transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute top-2 right-2 z-10">
        <EmployeeQuickActions
          employee={{ id: employee.id, fullName }}
          onEditEmployee={onEditEmployee}
        />
      </div>

      <CardContent className="flex flex-col gap-3 pt-1">
        <Link
          href={`/employees/${employee.id}`}
          className="flex items-center gap-4 pr-8 outline-none"
        >
          <Avatar className="size-[72px] shrink-0 shadow-sm ring-4 ring-background transition-transform group-hover:scale-[1.03] md:size-[88px] lg:size-[96px]">
            <AvatarImage src={employee.photoUrl} alt={fullName} />
            <AvatarFallback className="bg-accent text-xl font-medium text-accent-foreground md:text-2xl">
              {getInitials(employee.firstName, employee.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-base font-semibold text-foreground group-hover:text-primary">
              {fullName}
            </span>
            <span className="truncate text-sm text-muted-foreground">{employee.position}</span>
            <EmploymentStatusBadge status={employee.employmentStatus} />
            <span className="text-xs text-muted-foreground tabular-nums">{employee.finCode}</span>
          </div>
        </Link>

        <div className="grid w-full grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border pt-3 text-left text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{tTable("columnDepartment")}</span>
            <span className="truncate font-medium text-foreground">{employee.department}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{tTable("columnWorkLocation")}</span>
            <span className="truncate font-medium text-foreground">{employee.workLocation}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{t("hireDate")}</span>
            <span className="font-medium text-foreground tabular-nums">{employee.hireDate}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{t("manager")}</span>
            <span className="truncate font-medium text-foreground">
              {employee.managerName ?? t("noManager")}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{t("age")}</span>
            <span className="font-medium text-foreground tabular-nums">
              {calculateAgeFromDateOfBirth(employee.dateOfBirth)} yaş
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{t("salary")}</span>
            <span className="truncate font-medium text-foreground tabular-nums">
              {employee.baseSalary} {employee.currency}
            </span>
          </div>
        </div>

        <div className="flex w-full items-center justify-end border-t border-border pt-3">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    href={`mailto:${employee.email}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                  />
                }
              >
                <Mail className="size-3.5" strokeWidth={1.75} />
              </TooltipTrigger>
              <TooltipContent>{employee.email}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    href={`tel:${employee.phone}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                  />
                }
              >
                <Phone className="size-3.5" strokeWidth={1.75} />
              </TooltipTrigger>
              <TooltipContent>{employee.phone}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
