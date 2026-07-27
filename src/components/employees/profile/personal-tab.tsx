"use client"

import { useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoField, InfoGrid } from "@/components/common/info-field"
import type { EmployeeProfile } from "@/types/employee-profile"

interface PersonalTabProps {
  profile: EmployeeProfile
}

export function PersonalTab({ profile }: PersonalTabProps) {
  const t = useTranslations("Employees.profile.personal")
  const tTabs = useTranslations("Employees.profile.tabs")
  const tGender = useTranslations("Gender")
  const tMarital = useTranslations("MaritalStatus")

  const { personal } = profile

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{tTabs("personal")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField label={t("firstName")} value={personal.firstName} />
            <InfoField label={t("lastName")} value={personal.lastName} />
            <InfoField label={t("fatherName")} value={personal.fatherName} />
            <InfoField label={t("gender")} value={tGender(personal.gender)} />
            <InfoField label={t("dateOfBirth")} value={personal.dateOfBirth} />
            <InfoField label={t("nationality")} value={personal.nationality} />
            <InfoField
              label={t("maritalStatus")}
              value={tMarital(personal.maritalStatus)}
            />
            <InfoField label={t("finCode")} value={personal.finCode} />
            <InfoField label={t("nationalId")} value={personal.nationalId} />
            <InfoField label={t("passportNumber")} value={personal.passportNumber} />
            <InfoField label={t("address")} value={personal.address} span="2" />
            <InfoField label={t("phone")} value={personal.phone} />
            <InfoField label={t("email")} value={personal.email} />
          </InfoGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("emergencyContact")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid>
            <InfoField
              label={t("emergencyContactName")}
              value={personal.emergencyContactName}
            />
            <InfoField
              label={t("emergencyContactPhone")}
              value={personal.emergencyContactPhone}
            />
            <InfoField
              label={t("emergencyContactRelation")}
              value={personal.emergencyContactRelation}
            />
          </InfoGrid>
        </CardContent>
      </Card>
    </div>
  )
}
