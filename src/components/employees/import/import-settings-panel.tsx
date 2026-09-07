"use client"

import { useTranslations } from "next-intl"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ImportSettings } from "@/lib/employee-import/types"

interface ImportSettingsPanelProps {
  settings: ImportSettings
  onChange: (settings: ImportSettings) => void
}

/**
 * §12/§13/§14 — the three decisions Preview lets the user make before
 * committing: what happens to a row whose FIN already exists (skip, the
 * conservative default, or update it in place), whether an update
 * overwrites that employee's salary or leaves it alone (keep, the
 * conservative default), and a fallback salary start date for rows whose
 * file has no per-row one. Purely a settings editor — import-service.ts is
 * what actually applies these at write time.
 */
export function ImportSettingsPanel({ settings, onChange }: ImportSettingsPanelProps) {
  const t = useTranslations("Employees.import.preview.settings")

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h4 className="font-heading text-sm font-semibold text-foreground">{t("title")}</h4>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>{t("existingEmployeeStrategy")}</Label>
            <RadioGroup
              value={settings.existingEmployeeStrategy}
              onValueChange={(v) =>
                onChange({ ...settings, existingEmployeeStrategy: v as ImportSettings["existingEmployeeStrategy"] })
              }
            >
              <Label className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value="skip" />
                {t("skipExisting")}
              </Label>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value="update" />
                {t("updateExisting")}
              </Label>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("salaryStrategy")}</Label>
            <RadioGroup
              value={settings.salaryStrategy}
              onValueChange={(v) => onChange({ ...settings, salaryStrategy: v as ImportSettings["salaryStrategy"] })}
            >
              <Label className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value="keepExisting" />
                {t("keepExistingSalary")}
              </Label>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value="updateFromExcel" />
                {t("updateSalaryFromExcel")}
              </Label>
            </RadioGroup>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-default-salary-start-date">{t("defaultSalaryStartDate")}</Label>
          <Input
            id="import-default-salary-start-date"
            type="date"
            className="max-w-xs"
            value={settings.defaultSalaryStartDate}
            onChange={(event) => onChange({ ...settings, defaultSalaryStartDate: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t("defaultSalaryStartDateHint")}</p>
        </div>
      </CardContent>
    </Card>
  )
}
