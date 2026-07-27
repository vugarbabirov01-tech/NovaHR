"use client"

import { useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { InfoField, InfoGrid } from "@/components/common/info-field"
import { BooleanIndicator } from "@/components/employees/profile/boolean-indicator"
import {
  addDurations,
  calculateServiceDuration,
  contractTypeMessageKeys,
  employmentTypeMessageKeys,
  getFullName,
  getInitials,
  isMinorFromDateOfBirth,
  workLocationTypeMessageKeys,
} from "@/lib/employees"
import { CUSTOM_WORK_SCHEDULE_ID, type WizardMasterData } from "@/lib/employee-wizard-mapper"
import type { EmployeeWizardData } from "@/types/employee-wizard"
import type { WorkExperienceDuration } from "@/types/employee-profile"

interface StepProps {
  data: EmployeeWizardData
  masterData: WizardMasterData
}

/** Read-only display only — never stored. */
function formatDuration(duration: WorkExperienceDuration, t: (key: string) => string) {
  return `${duration.years} ${t("durationYears")} ${duration.months} ${t("durationMonths")} ${duration.days} ${t("durationDays")}`
}

export function ReviewStep({ data, masterData }: StepProps) {
  const t = useTranslations("Employees.wizard")
  const tTabs = useTranslations("Employees.profile.tabs")
  const tPersonal = useTranslations("Employees.profile.personal")
  const tEmployment = useTranslations("Employees.profile.employment")
  const tLabourLaw = useTranslations("Employees.profile.labourLaw")
  const tPayroll = useTranslations("Employees.profile.payroll")
  const tDocuments = useTranslations("Employees.profile.documents")
  const tDocCategories = useTranslations("Employees.profile.documents.categories")
  const tGender = useTranslations("Gender")
  const tMarital = useTranslations("MaritalStatus")
  const tType = useTranslations("EmploymentType")
  const tContract = useTranslations("ContractType")
  const tLocation = useTranslations("WorkLocationType")

  const department = masterData.departments.find((d) => d.id === data.departmentId)
  const position = masterData.positions.find((p) => p.id === data.positionId)
  const company = masterData.companies.find((c) => c.id === data.companyId)
  const branch = masterData.branches.find((b) => b.id === data.branchId)
  const schedule = masterData.workSchedules.find((s) => s.id === data.scheduleId)
  const manager = masterData.managers.find((m) => m.id === data.managerId)
  const workScheduleLabel =
    data.scheduleId === CUSTOM_WORK_SCHEDULE_ID ? data.customWorkScheduleLabel : (schedule?.label ?? "")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-semibold text-foreground">
          {t("reviewTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("reviewDescription")}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{tTabs("personal")}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-14 shrink-0 ring-4 ring-background">
              {data.photoUrl ? <AvatarImage src={data.photoUrl} alt={getFullName(data)} /> : null}
              <AvatarFallback className="bg-accent text-accent-foreground">
                {getInitials(data.firstName, data.lastName)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{getFullName(data)}</span>
          </div>
          <InfoGrid>
            <InfoField label={tPersonal("firstName")} value={data.firstName} />
            <InfoField label={tPersonal("lastName")} value={data.lastName} />
            <InfoField label={tPersonal("fatherName")} value={data.fatherName} />
            <InfoField label={tPersonal("gender")} value={data.gender ? tGender(data.gender) : ""} />
            <InfoField label={tPersonal("dateOfBirth")} value={data.dateOfBirth} />
            <InfoField label={tPersonal("nationality")} value={data.nationality} />
            <InfoField
              label={tPersonal("maritalStatus")}
              value={data.maritalStatus ? tMarital(data.maritalStatus) : ""}
            />
            <InfoField label={tPersonal("finCode")} value={data.finCode} />
            <InfoField label={tPersonal("nationalId")} value={data.nationalId} />
            <InfoField label={tPersonal("idIssuingAuthority")} value={data.idIssuingAuthority} />
            <InfoField label={tPersonal("phone")} value={data.phone} />
            <InfoField label={tPersonal("email")} value={data.email} />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tTabs("employment")}</CardTitle></CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField label={tEmployment("employeeNumber")} value={data.employeeNumber} />
            <InfoField label={tEmployment("hireDate")} value={data.hireDate} />
            <InfoField
              label={tEmployment("employmentType")}
              value={data.employmentType ? tType(employmentTypeMessageKeys[data.employmentType]) : ""}
            />
            <InfoField
              label={tEmployment("contractType")}
              value={data.contractType ? tContract(contractTypeMessageKeys[data.contractType]) : ""}
            />
            <InfoField label={tEmployment("department")} value={department?.name} />
            <InfoField label={tEmployment("position")} value={position?.title} />
            <InfoField label={tEmployment("company")} value={company?.name} />
            <InfoField label={tEmployment("branch")} value={branch?.name} />
            <InfoField label={tEmployment("manager")} value={manager?.name} />
            <InfoField label={tEmployment("workSchedule")} value={workScheduleLabel} />
            <InfoField
              label={tEmployment("workLocationType")}
              value={data.workLocationType ? tLocation(workLocationTypeMessageKeys[data.workLocationType]) : ""}
            />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tTabs("labourLaw")}</CardTitle></CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField
              label={tLabourLaw("veteranStatus.label")}
              value={data.veteranStatus ? tLabourLaw(`veteranStatus.${data.veteranStatus}`) : tLabourLaw("veteranStatus.none")}
            />
            <InfoField label={tLabourLaw("hasDisability")} value={<BooleanIndicator value={data.hasDisability} />} />
            <InfoField
              label={tLabourLaw("isMinor")}
              value={<BooleanIndicator value={isMinorFromDateOfBirth(data.dateOfBirth)} />}
            />
            <InfoField label={tLabourLaw("isPregnant")} value={<BooleanIndicator value={data.isPregnant} />} />
            <InfoField label={tLabourLaw("children")} value={data.children.length} />
            <InfoField label={tLabourLaw("hazardousWork")} value={<BooleanIndicator value={data.hazardousWork} />} />
            <InfoField label={tLabourLaw("nightShiftWork")} value={<BooleanIndicator value={data.nightShiftWork} />} />
            <InfoField
              label={tLabourLaw("totalWorkExperience")}
              value={formatDuration(
                addDurations(data.previousWorkExperience, calculateServiceDuration(data.hireDate)),
                tLabourLaw
              )}
            />
            <InfoField
              label={tLabourLaw("hasCollectiveAgreementLeave")}
              value={<BooleanIndicator value={data.hasCollectiveAgreementLeave} />}
            />
            {data.hasCollectiveAgreementLeave ? (
              <InfoField
                label={tLabourLaw("collectiveAgreementLeaveDays")}
                value={data.collectiveAgreementLeaveDays}
              />
            ) : null}
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tTabs("payroll")}</CardTitle></CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField label={tPayroll("bank")} value={data.bankName} />
            <InfoField label={tPayroll("salary")} value={`${data.baseSalary} ${data.currency}`} />
            <InfoField label={tPayroll("bonus")} value={`${data.bonus} ${data.currency}`} />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tTabs("documents")}</CardTitle></CardHeader>
        <CardContent>
          {data.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tDocuments("noDocuments")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {data.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{doc.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tDocCategories(doc.category)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
