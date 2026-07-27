"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, ChevronUp, Info, Plus, Trash2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field } from "@/components/common/field"
import { FormSection } from "@/components/common/form-section"
import { EnumSelect } from "@/components/common/enum-select"
import { ToggleField } from "@/components/employees/wizard/toggle-field"
import {
  addDurations,
  calculateAgeFromDateOfBirth,
  calculateServiceDuration,
  isMinorFromDateOfBirth,
  isRetirementAgeFromDateOfBirth,
} from "@/lib/employees"
import type { EmployeeWizardData } from "@/types/employee-wizard"
import type {
  EmployeeChild,
  ProfessionalCategory,
  VeteranStatus,
  WorkExperienceDuration,
} from "@/types/employee-profile"

interface StepProps {
  data: EmployeeWizardData
  onChange: (patch: Partial<EmployeeWizardData>) => void
}

function generateChildId() {
  return `CHILD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Read-only display only — never stored. */
function formatDuration(duration: WorkExperienceDuration, t: (key: string) => string) {
  return `${duration.years} ${t("durationYears")} ${duration.months} ${t("durationMonths")} ${duration.days} ${t("durationDays")}`
}

export function LabourLawStep({ data, onChange }: StepProps) {
  const t = useTranslations("Employees.profile.labourLaw")
  const tCommon = useTranslations("Common")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const isMinor = isMinorFromDateOfBirth(data.dateOfBirth)
  const minorAge = calculateAgeFromDateOfBirth(data.dateOfBirth)
  const isRetirementAge = isRetirementAgeFromDateOfBirth(data.dateOfBirth, data.gender)

  const companyServiceDuration = calculateServiceDuration(data.hireDate)
  const totalWorkExperience = addDurations(data.previousWorkExperience, companyServiceDuration)

  function addChild() {
    const child: EmployeeChild = {
      id: generateChildId(),
      fullName: "",
      dateOfBirth: "",
      hasDisability: false,
      disabilityCertificateExpiryDate: "",
    }
    onChange({ children: [...data.children, child] })
  }

  function updateChild(id: string, patch: Partial<EmployeeChild>) {
    onChange({
      children: data.children.map((child) => (child.id === id ? { ...child, ...patch } : child)),
    })
  }

  function removeChild(id: string) {
    onChange({ children: data.children.filter((child) => child.id !== id) })
  }

  const veteranStatusOptions = (
    ["warVeteran", "combatParticipant", "liberatedTerritoriesSpecialist", "stateDecorationHolder"] as const
  ).map((status: VeteranStatus) => ({ value: status, label: t(`veteranStatus.${status}`) }))

  const professionalCategoryOptions = (
    ["civilServant", "judge", "prosecutor", "academicStaff", "medicalStaff"] as const
  ).map((category: ProfessionalCategory) => ({ value: category, label: t(`professionalCategory.${category}`) }))

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <Info />
        <AlertDescription>{t("disclaimer")}</AlertDescription>
      </Alert>

      {/* 1. Family */}
      <FormSection title={t("sectionFamily")}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <ToggleField
              id="isPregnant"
              label={t("isPregnant")}
              checked={data.isPregnant}
              onCheckedChange={(v) => onChange({ isPregnant: v })}
            />
            <ToggleField
              id="isSingleParent"
              label={t("isSingleParent")}
              checked={data.isSingleParent}
              onCheckedChange={(v) => onChange({ isSingleParent: v })}
            />
            <ToggleField
              id="isAdoptiveParent"
              label={t("isAdoptiveParent")}
              checked={data.isAdoptiveParent}
              onCheckedChange={(v) => onChange({ isAdoptiveParent: v })}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{t("children")}</p>
              <Button type="button" variant="outline" size="sm" onClick={addChild}>
                <Plus className="size-3.5" strokeWidth={1.75} />
                {t("addChild")}
              </Button>
            </div>

            {data.children.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noChildren")}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.children.map((child) => (
                  <div key={child.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                      <Field label={t("childFullName")} htmlFor={`child-name-${child.id}`}>
                        <Input
                          id={`child-name-${child.id}`}
                          value={child.fullName}
                          onChange={(e) => updateChild(child.id, { fullName: e.target.value })}
                        />
                      </Field>
                      <Field label={t("childDateOfBirth")} htmlFor={`child-dob-${child.id}`}>
                        <Input
                          id={`child-dob-${child.id}`}
                          type="date"
                          value={child.dateOfBirth}
                          onChange={(e) => updateChild(child.id, { dateOfBirth: e.target.value })}
                        />
                      </Field>
                      <ToggleField
                        id={`child-disability-${child.id}`}
                        label={t("childHasDisability")}
                        checked={child.hasDisability}
                        onCheckedChange={(v) =>
                          updateChild(child.id, {
                            hasDisability: v,
                            disabilityCertificateExpiryDate: v ? child.disabilityCertificateExpiryDate : "",
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeChild(child.id)}
                        aria-label={t("removeChild")}
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} />
                      </Button>
                    </div>
                    {child.hasDisability ? (
                      <Field label={t("childDisabilityExpiryDate")} htmlFor={`child-exp-${child.id}`}>
                        <Input
                          id={`child-exp-${child.id}`}
                          type="date"
                          value={child.disabilityCertificateExpiryDate}
                          onChange={(e) => updateChild(child.id, { disabilityCertificateExpiryDate: e.target.value })}
                        />
                      </Field>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </FormSection>

      {/* 2. Disability */}
      <FormSection title={t("sectionDisability")}>
        <div className="flex flex-col gap-3">
          <ToggleField
            id="hasDisability"
            label={t("hasDisability")}
            checked={data.hasDisability}
            onCheckedChange={(v) => onChange({ hasDisability: v })}
          />
          {data.hasDisability ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("disabilityGroup")} htmlFor="disabilityGroup">
                <EnumSelect
                  id="disabilityGroup"
                  value={data.disabilityGroup}
                  onValueChange={(v) => onChange({ disabilityGroup: v as EmployeeWizardData["disabilityGroup"] })}
                  options={["I", "II", "III"].map((group) => ({ value: group, label: group }))}
                  placeholder={tCommon("selectPlaceholder")}
                />
              </Field>
              <Field label={t("disabilityCause")} htmlFor="disabilityCause">
                <Input
                  id="disabilityCause"
                  value={data.disabilityCause}
                  onChange={(e) => onChange({ disabilityCause: e.target.value })}
                />
              </Field>
              <Field label={t("disabilityCertificateExpiryDate")} htmlFor="disabilityCertificateExpiryDate">
                <Input
                  id="disabilityCertificateExpiryDate"
                  type="date"
                  value={data.disabilityCertificateExpiryDate}
                  onChange={(e) => onChange({ disabilityCertificateExpiryDate: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </FormSection>

      {/* 3. Age Status — read-only, derived from Personal step's Date of Birth / Gender */}
      <FormSection title={t("sectionAgeStatus")} description={t("ageStatusHint")}>
        <div className="flex flex-wrap gap-2">
          <Field label={t("isMinor")} htmlFor="ageStatusMinor">
            <div id="ageStatusMinor">
              <Badge variant={isMinor ? "default" : "outline"}>
                {isMinor ? t("yes") : t("no")}
                {data.dateOfBirth ? ` — ${t("years", { count: minorAge })}` : ""}
              </Badge>
            </div>
          </Field>
          <Field label={t("isRetirementAge")} htmlFor="ageStatusRetirement">
            <div id="ageStatusRetirement">
              <Badge variant={isRetirementAge ? "default" : "outline"}>
                {isRetirementAge ? t("yes") : t("no")}
              </Badge>
            </div>
          </Field>
        </div>
      </FormSection>

      {/* 4. Veteran Status */}
      <FormSection title={t("sectionVeteranStatus")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("veteranStatus.label")} htmlFor="veteranStatus">
            <EnumSelect
              id="veteranStatus"
              value={data.veteranStatus}
              onValueChange={(v) => onChange({ veteranStatus: v as EmployeeWizardData["veteranStatus"] })}
              options={veteranStatusOptions}
              placeholder={t("veteranStatus.none")}
            />
          </Field>
          {data.veteranStatus === "stateDecorationHolder" ? (
            <Field label={t("stateDecorationName")} htmlFor="stateDecorationName">
              <Input
                id="stateDecorationName"
                value={data.stateDecorationName}
                onChange={(e) => onChange({ stateDecorationName: e.target.value })}
              />
            </Field>
          ) : null}
        </div>
      </FormSection>

      {/* 5. Professional Category */}
      <FormSection title={t("sectionProfessionalCategory")}>
        <Field label={t("professionalCategory.label")} htmlFor="professionalCategory" className="sm:max-w-72">
          <EnumSelect
            id="professionalCategory"
            value={data.professionalCategory}
            onValueChange={(v) => onChange({ professionalCategory: v as EmployeeWizardData["professionalCategory"] })}
            options={professionalCategoryOptions}
            placeholder={t("professionalCategory.none")}
          />
        </Field>
      </FormSection>

      {/* 6. Working Conditions */}
      <FormSection title={t("sectionWorkingConditions")}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <ToggleField
              id="hazardousWork"
              label={t("hazardousWork")}
              checked={data.hazardousWork}
              onCheckedChange={(v) => onChange({ hazardousWork: v })}
            />
            <ToggleField
              id="undergroundWork"
              label={t("undergroundWork")}
              checked={data.undergroundWork}
              onCheckedChange={(v) => onChange({ undergroundWork: v })}
            />
            <ToggleField
              id="nightShiftWork"
              label={t("nightShiftWork")}
              checked={data.nightShiftWork}
              onCheckedChange={(v) => onChange({ nightShiftWork: v })}
            />
            <ToggleField
              id="isShiftWork"
              label={t("isShiftWork")}
              checked={data.isShiftWork}
              onCheckedChange={(v) => onChange({ isShiftWork: v })}
            />
          </div>
          <Field label={t("workingConditionsNotes")} htmlFor="workingConditionsNotes">
            <Textarea
              id="workingConditionsNotes"
              rows={2}
              value={data.workingConditionsNotes}
              onChange={(e) => onChange({ workingConditionsNotes: e.target.value })}
            />
          </Field>
        </div>
      </FormSection>

      {/* 7. Work Experience */}
      <FormSection title={t("sectionExperience")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-foreground">{t("previousWorkExperience")}</p>
            <div className="grid max-w-md grid-cols-3 gap-3">
              <Field label={t("durationYears")} htmlFor="prevExpYears">
                <Input
                  id="prevExpYears"
                  type="number"
                  min={0}
                  value={data.previousWorkExperience.years}
                  onChange={(e) =>
                    onChange({
                      previousWorkExperience: { ...data.previousWorkExperience, years: Number(e.target.value) || 0 },
                    })
                  }
                />
              </Field>
              <Field label={t("durationMonths")} htmlFor="prevExpMonths">
                <Input
                  id="prevExpMonths"
                  type="number"
                  min={0}
                  max={11}
                  value={data.previousWorkExperience.months}
                  onChange={(e) =>
                    onChange({
                      previousWorkExperience: { ...data.previousWorkExperience, months: Number(e.target.value) || 0 },
                    })
                  }
                />
              </Field>
              <Field label={t("durationDays")} htmlFor="prevExpDays">
                <Input
                  id="prevExpDays"
                  type="number"
                  min={0}
                  max={29}
                  value={data.previousWorkExperience.days}
                  onChange={(e) =>
                    onChange({
                      previousWorkExperience: { ...data.previousWorkExperience, days: Number(e.target.value) || 0 },
                    })
                  }
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("companyServiceDuration")} htmlFor="companyServiceDuration">
              <div id="companyServiceDuration">
                <Badge variant="outline">{formatDuration(companyServiceDuration, t)}</Badge>
              </div>
            </Field>
            <Field label={t("totalWorkExperience")} htmlFor="totalWorkExperience">
              <div id="totalWorkExperience">
                <Badge variant="outline">{formatDuration(totalWorkExperience, t)}</Badge>
              </div>
            </Field>
          </div>
        </div>
      </FormSection>

      {/* 8. Additional Leave Sources */}
      <FormSection title={t("sectionAdditionalLeave")} description={t("sectionAdditionalLeaveHint")}>
        <div className="flex flex-col gap-3">
          <ToggleField
            id="hasCollectiveAgreementLeave"
            label={t("hasCollectiveAgreementLeave")}
            checked={data.hasCollectiveAgreementLeave}
            onCheckedChange={(v) => onChange({ hasCollectiveAgreementLeave: v })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.hasCollectiveAgreementLeave ? (
              <Field label={t("collectiveAgreementLeaveDays")} htmlFor="collectiveAgreementLeaveDays">
                <Input
                  id="collectiveAgreementLeaveDays"
                  type="number"
                  min={0}
                  value={data.collectiveAgreementLeaveDays}
                  onChange={(e) => onChange({ collectiveAgreementLeaveDays: Number(e.target.value) })}
                />
              </Field>
            ) : null}
            <Field label={t("companyAdditionalLeaveDays")} htmlFor="companyAdditionalLeaveDays">
              <Input
                id="companyAdditionalLeaveDays"
                type="number"
                min={0}
                value={data.companyAdditionalLeaveDays}
                onChange={(e) => onChange({ companyAdditionalLeaveDays: Number(e.target.value) })}
              />
            </Field>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            {showAdvanced ? (
              <ChevronUp className="size-3.5" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="size-3.5" strokeWidth={1.75} />
            )}
            {t("advancedSection")}
          </Button>
          {showAdvanced ? (
            <Field
              label={t("manualLeaveAdjustmentDays")}
              htmlFor="manualLeaveAdjustmentDays"
              hint={t("manualLeaveAdjustmentHint")}
              className="sm:max-w-72"
            >
              <Input
                id="manualLeaveAdjustmentDays"
                type="number"
                min={0}
                value={data.manualLeaveAdjustmentDays}
                onChange={(e) => onChange({ manualLeaveAdjustmentDays: Number(e.target.value) })}
              />
            </Field>
          ) : null}
        </div>
      </FormSection>

      {/* 9. Labour Law Notes */}
      <FormSection title={t("notes")}>
        <Textarea
          aria-label={t("notes")}
          rows={3}
          value={data.labourLawNotes}
          onChange={(e) => onChange({ labourLawNotes: e.target.value })}
        />
      </FormSection>
    </div>
  )
}
