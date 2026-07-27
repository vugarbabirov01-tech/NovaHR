"use client"

import { useTranslations } from "next-intl"
import { Info } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { InfoField, InfoGrid } from "@/components/common/info-field"
import { BooleanIndicator } from "@/components/employees/profile/boolean-indicator"
import {
  addDurations,
  calculateAgeFromDateOfBirth,
  calculateServiceDuration,
  isMinorFromDateOfBirth,
  isRetirementAgeFromDateOfBirth,
} from "@/lib/employees"
import type { EmployeeProfile, WorkExperienceDuration } from "@/types/employee-profile"

interface LabourLawTabProps {
  profile: EmployeeProfile
}

/** Read-only display only — never stored. */
function formatDuration(duration: WorkExperienceDuration, t: (key: string) => string) {
  return `${duration.years} ${t("durationYears")} ${duration.months} ${t("durationMonths")} ${duration.days} ${t("durationDays")}`
}

export function LabourLawTab({ profile }: LabourLawTabProps) {
  const t = useTranslations("Employees.profile.labourLaw")
  const { labourLaw, personal, employment } = profile

  const minor = isMinorFromDateOfBirth(personal.dateOfBirth)
  const minorAge = calculateAgeFromDateOfBirth(personal.dateOfBirth)
  const retirementAge = isRetirementAgeFromDateOfBirth(personal.dateOfBirth, personal.gender)

  const companyServiceDuration = calculateServiceDuration(employment.hireDate)
  const totalWorkExperience = addDurations(labourLaw.previousWorkExperience, companyServiceDuration)

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertDescription>{t("disclaimer")}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionFamily")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <InfoGrid>
            <InfoField label={t("isPregnant")} value={<BooleanIndicator value={labourLaw.isPregnant} />} />
            <InfoField label={t("isSingleParent")} value={<BooleanIndicator value={labourLaw.isSingleParent} />} />
            <InfoField label={t("isAdoptiveParent")} value={<BooleanIndicator value={labourLaw.isAdoptiveParent} />} />
          </InfoGrid>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{t("children")}</p>
            {labourLaw.children.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noChildren")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {labourLaw.children.map((child) => (
                  <li
                    key={child.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">{child.fullName}</span>
                    <span className="text-muted-foreground tabular-nums">{child.dateOfBirth}</span>
                    {child.hasDisability ? (
                      <Badge variant="outline">{t("childHasDisability")}</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionDisability")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField label={t("hasDisability")} value={<BooleanIndicator value={labourLaw.hasDisability} />} />
            {labourLaw.hasDisability ? (
              <>
                <InfoField label={t("disabilityGroup")} value={labourLaw.disabilityGroup} />
                <InfoField label={t("disabilityCause")} value={labourLaw.disabilityCause} />
                <InfoField
                  label={t("disabilityCertificateExpiryDate")}
                  value={labourLaw.disabilityCertificateExpiryDate}
                />
              </>
            ) : null}
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionAgeStatus")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField
              label={t("isMinor")}
              value={
                <Badge variant={minor ? "default" : "outline"}>
                  {minor ? t("yes") : t("no")}
                  {personal.dateOfBirth ? ` — ${t("years", { count: minorAge })}` : ""}
                </Badge>
              }
            />
            <InfoField
              label={t("isRetirementAge")}
              value={<Badge variant={retirementAge ? "default" : "outline"}>{retirementAge ? t("yes") : t("no")}</Badge>}
            />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionVeteranStatus")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField
              label={t("veteranStatus.label")}
              value={labourLaw.veteranStatus ? t(`veteranStatus.${labourLaw.veteranStatus}`) : t("veteranStatus.none")}
            />
            {labourLaw.veteranStatus === "stateDecorationHolder" ? (
              <InfoField label={t("stateDecorationName")} value={labourLaw.stateDecorationName} />
            ) : null}
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionProfessionalCategory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField
              label={t("professionalCategory.label")}
              value={
                labourLaw.professionalCategory
                  ? t(`professionalCategory.${labourLaw.professionalCategory}`)
                  : t("professionalCategory.none")
              }
            />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionWorkingConditions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField label={t("hazardousWork")} value={<BooleanIndicator value={labourLaw.hazardousWork} />} />
            <InfoField label={t("undergroundWork")} value={<BooleanIndicator value={labourLaw.undergroundWork} />} />
            <InfoField label={t("nightShiftWork")} value={<BooleanIndicator value={labourLaw.nightShiftWork} />} />
            <InfoField label={t("isShiftWork")} value={<BooleanIndicator value={labourLaw.isShiftWork} />} />
            {labourLaw.workingConditionsNotes ? (
              <InfoField label={t("workingConditionsNotes")} value={labourLaw.workingConditionsNotes} span="2" />
            ) : null}
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionExperience")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField
              label={t("previousWorkExperience")}
              value={formatDuration(labourLaw.previousWorkExperience, t)}
            />
            <InfoField label={t("companyServiceDuration")} value={formatDuration(companyServiceDuration, t)} />
            <InfoField label={t("totalWorkExperience")} value={formatDuration(totalWorkExperience, t)} />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionAdditionalLeave")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField
              label={t("hasCollectiveAgreementLeave")}
              value={<BooleanIndicator value={labourLaw.hasCollectiveAgreementLeave} />}
            />
            {labourLaw.hasCollectiveAgreementLeave ? (
              <InfoField label={t("collectiveAgreementLeaveDays")} value={labourLaw.collectiveAgreementLeaveDays} />
            ) : null}
            <InfoField label={t("companyAdditionalLeaveDays")} value={labourLaw.companyAdditionalLeaveDays} />
            {labourLaw.manualLeaveAdjustmentDays ? (
              <InfoField label={t("manualLeaveAdjustmentDays")} value={labourLaw.manualLeaveAdjustmentDays} />
            ) : null}
          </InfoGrid>
        </CardContent>
      </Card>

      {labourLaw.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{labourLaw.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
