"use client"

import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/common/field"
import { FormSection } from "@/components/common/form-section"
import { EnumSelect } from "@/components/common/enum-select"
import { EmployeePhotoUpload } from "@/components/employees/wizard/employee-photo-upload"
import type { WizardValidationErrors } from "@/lib/employee-wizard-validation"
import type { EmployeeWizardData } from "@/types/employee-wizard"

interface StepProps {
  data: EmployeeWizardData
  onChange: (patch: Partial<EmployeeWizardData>) => void
  errors?: WizardValidationErrors
}

export function PersonalStep({ data, onChange, errors = {} }: StepProps) {
  const t = useTranslations("Employees.profile.personal")
  const tTabs = useTranslations("Employees.profile.tabs")
  const tGender = useTranslations("Gender")
  const tMarital = useTranslations("MaritalStatus")
  const tCommon = useTranslations("Common")

  return (
    <div className="flex flex-col gap-6">
      <FormSection title={t("photo")}>
        <EmployeePhotoUpload
          value={data.photoUrl}
          onChange={(photoUrl) => onChange({ photoUrl })}
          firstName={data.firstName}
          lastName={data.lastName}
          error={errors.photoUrl}
        />
      </FormSection>

      <FormSection title={tTabs("personal")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("firstName")} htmlFor="firstName" required error={errors.firstName}>
            <Input
              id="firstName"
              value={data.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
            />
          </Field>
          <Field label={t("lastName")} htmlFor="lastName" required error={errors.lastName}>
            <Input
              id="lastName"
              value={data.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
            />
          </Field>
          <Field label={t("fatherName")} htmlFor="fatherName">
            <Input
              id="fatherName"
              value={data.fatherName}
              onChange={(e) => onChange({ fatherName: e.target.value })}
            />
          </Field>
          <Field label={t("gender")} htmlFor="gender" required error={errors.gender}>
            <EnumSelect
              id="gender"
              value={data.gender}
              onValueChange={(v) => onChange({ gender: v as EmployeeWizardData["gender"] })}
              options={[
                { value: "male", label: tGender("male") },
                { value: "female", label: tGender("female") },
              ]}
              placeholder={tCommon("selectPlaceholder")}
            />
          </Field>
          <Field label={t("dateOfBirth")} htmlFor="dateOfBirth" required error={errors.dateOfBirth}>
            <Input
              id="dateOfBirth"
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => onChange({ dateOfBirth: e.target.value })}
            />
          </Field>
          <Field label={t("nationality")} htmlFor="nationality">
            <Input
              id="nationality"
              value={data.nationality}
              onChange={(e) => onChange({ nationality: e.target.value })}
            />
          </Field>
          <Field label={t("maritalStatus")} htmlFor="maritalStatus">
            <EnumSelect
              id="maritalStatus"
              value={data.maritalStatus}
              onValueChange={(v) => onChange({ maritalStatus: v as EmployeeWizardData["maritalStatus"] })}
              options={[
                { value: "single", label: tMarital("single") },
                { value: "married", label: tMarital("married") },
                { value: "divorced", label: tMarital("divorced") },
                { value: "widowed", label: tMarital("widowed") },
              ]}
              placeholder={tCommon("selectPlaceholder")}
            />
          </Field>
          <Field label={t("phone")} htmlFor="phone" required error={errors.phone}>
            <Input id="phone" value={data.phone} onChange={(e) => onChange({ phone: e.target.value })} />
          </Field>
          <Field label={t("email")} htmlFor="email" required error={errors.email}>
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
          </Field>
          <Field label={t("address")} htmlFor="address" className="sm:col-span-2">
            <Textarea
              id="address"
              rows={2}
              value={data.address}
              onChange={(e) => onChange({ address: e.target.value })}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t("identitySection")} description={t("identitySectionHint")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("finCode")} htmlFor="finCode" required error={errors.finCode}>
            <Input id="finCode" value={data.finCode} onChange={(e) => onChange({ finCode: e.target.value })} />
          </Field>
          <Field label={t("nationalId")} htmlFor="nationalId">
            <Input
              id="nationalId"
              value={data.nationalId}
              onChange={(e) => onChange({ nationalId: e.target.value })}
            />
          </Field>
          <Field label={t("idIssuingAuthority")} htmlFor="idIssuingAuthority">
            <Input
              id="idIssuingAuthority"
              value={data.idIssuingAuthority}
              onChange={(e) => onChange({ idIssuingAuthority: e.target.value })}
            />
          </Field>
          <Field label={t("passportNumber")} htmlFor="passportNumber">
            <Input
              id="passportNumber"
              value={data.passportNumber}
              onChange={(e) => onChange({ passportNumber: e.target.value })}
            />
          </Field>
          <Field label={t("idIssueDate")} htmlFor="idIssueDate">
            <Input
              id="idIssueDate"
              type="date"
              value={data.idIssueDate}
              onChange={(e) => onChange({ idIssueDate: e.target.value })}
            />
          </Field>
          <Field label={t("idExpiryDate")} htmlFor="idExpiryDate">
            <Input
              id="idExpiryDate"
              type="date"
              value={data.idExpiryDate}
              onChange={(e) => onChange({ idExpiryDate: e.target.value })}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t("emergencyContact")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("emergencyContactName")} htmlFor="emergencyContactName">
            <Input
              id="emergencyContactName"
              value={data.emergencyContactName}
              onChange={(e) => onChange({ emergencyContactName: e.target.value })}
            />
          </Field>
          <Field label={t("emergencyContactPhone")} htmlFor="emergencyContactPhone">
            <Input
              id="emergencyContactPhone"
              value={data.emergencyContactPhone}
              onChange={(e) => onChange({ emergencyContactPhone: e.target.value })}
            />
          </Field>
          <Field label={t("emergencyContactRelation")} htmlFor="emergencyContactRelation">
            <Input
              id="emergencyContactRelation"
              value={data.emergencyContactRelation}
              onChange={(e) => onChange({ emergencyContactRelation: e.target.value })}
            />
          </Field>
        </div>
      </FormSection>
    </div>
  )
}
