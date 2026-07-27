"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface SelectWorksheetStepProps {
  sheetNames: string[]
  selectedSheet: string
  onSelect: (sheetName: string) => void
  onBack: () => void
}

export function SelectWorksheetStep({ sheetNames, selectedSheet, onSelect, onBack }: SelectWorksheetStepProps) {
  const t = useTranslations("Employees.import.worksheet")
  const [value, setValue] = useState(selectedSheet || sheetNames[0] || "")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-semibold text-foreground">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <RadioGroup value={value} onValueChange={setValue}>
        {sheetNames.map((name) => (
          <Label
            key={name}
            className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm font-medium has-data-checked:border-primary has-data-checked:bg-accent/50"
          >
            <RadioGroupItem value={name} />
            {name}
          </Label>
        ))}
      </RadioGroup>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
        <Button disabled={!value} onClick={() => onSelect(value)}>
          {t("next")}
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  )
}
