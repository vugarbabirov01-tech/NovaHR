"use client"

import { useTranslations } from "next-intl"
import { GraduationCap, Languages as LanguagesIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/common/empty-state"
import type { EmployeeProfile } from "@/types/employee-profile"

interface EducationTabProps {
  profile: EmployeeProfile
}

export function EducationTab({ profile }: EducationTabProps) {
  const t = useTranslations("Employees.profile.education")
  const tProficiency = useTranslations("Employees.profile.education.proficiency")
  const { education } = profile

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("universities")}</CardTitle>
        </CardHeader>
        <CardContent>
          {education.universities.length === 0 ? (
            <EmptyState icon={GraduationCap} title={t("noEntries")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {education.universities.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{entry.institution}</p>
                  <p className="text-xs text-muted-foreground">
                    {[entry.degree, entry.fieldOfStudy].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {entry.startYear} – {entry.endYear ?? ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("schools")}</CardTitle>
        </CardHeader>
        <CardContent>
          {education.schools.length === 0 ? (
            <EmptyState icon={GraduationCap} title={t("noEntries")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {education.schools.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{entry.institution}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {entry.startYear} – {entry.endYear ?? ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("certificates")}</CardTitle>
        </CardHeader>
        <CardContent>
          {education.certificates.length === 0 ? (
            <EmptyState icon={GraduationCap} title={t("noEntries")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {education.certificates.map((cert) => (
                <li
                  key={cert.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{cert.name}</p>
                    <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground tabular-nums">
                    <p>{cert.issueDate}</p>
                    {cert.expiryDate ? <p>→ {cert.expiryDate}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("languages")}</CardTitle>
          </CardHeader>
          <CardContent>
            {education.languages.length === 0 ? (
              <EmptyState icon={LanguagesIcon} title={t("noEntries")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {education.languages.map((lang) => (
                  <li key={lang.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{lang.language}</span>
                    <Badge variant="secondary">
                      {tProficiency(lang.proficiency)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("skills")}</CardTitle>
          </CardHeader>
          <CardContent>
            {education.skills.length === 0 ? (
              <EmptyState icon={GraduationCap} title={t("noEntries")} />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {education.skills.map((skill) => (
                  <Badge key={skill} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
