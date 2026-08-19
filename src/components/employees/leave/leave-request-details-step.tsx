"use client"

import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/common/field"
import { EnumSelect } from "@/components/common/enum-select"
import { DatePicker } from "@/components/common/date-picker"
import type { LeaveType } from "@/repositories/leave-type-repository"

export interface LeaveRequestDetailsData {
  leaveTypeId: string
  startDate: string
  numberOfDays: string
  reason: string
}

// Display order only — leaveTypes itself (ids, names, translations, the
// underlying query) is untouched. Codes not listed here (a future leave
// type) sort after all known ones rather than disappearing. MATERNITY/
// PATERNITY dropped from this list along with their leave types going
// inactive (prisma/seed.ts) — findActiveLeaveTypes() already excludes them
// from `leaveTypes`, so they'd never reach this function anyway; SOCIAL
// replaces them in the offered lineup.
const LEAVE_TYPE_DISPLAY_ORDER = ["ANNUAL", "UNPAID", "STUDY", "SOCIAL", "SICK"]

function byPresentationOrder(a: LeaveType, b: LeaveType): number {
  const aIndex = LEAVE_TYPE_DISPLAY_ORDER.indexOf(a.code)
  const bIndex = LEAVE_TYPE_DISPLAY_ORDER.indexOf(b.code)
  if (aIndex === -1 && bIndex === -1) return 0
  if (aIndex === -1) return 1
  if (bIndex === -1) return -1
  return aIndex - bIndex
}

interface LeaveRequestDetailsStepProps {
  data: LeaveRequestDetailsData
  onChange: (patch: Partial<LeaveRequestDetailsData>) => void
  leaveTypes: LeaveType[]
  errors?: Partial<Record<keyof LeaveRequestDetailsData, string>>
}

export function LeaveRequestDetailsStep({
  data,
  onChange,
  leaveTypes,
  errors = {},
}: LeaveRequestDetailsStepProps) {
  const t = useTranslations("Employees.leaveRequest.details")

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Field
        label={t("leaveType")}
        htmlFor="leaveTypeId"
        required
        error={errors.leaveTypeId}
        className="sm:col-span-2"
      >
        <EnumSelect
          id="leaveTypeId"
          value={data.leaveTypeId}
          onValueChange={(v) => onChange({ leaveTypeId: v })}
          options={[...leaveTypes]
            .sort(byPresentationOrder)
            .map((leaveType) => ({ value: leaveType.id, label: leaveType.name }))}
          placeholder={t("leaveTypePlaceholder")}
        />
      </Field>
      <Field label={t("startDate")} htmlFor="startDate" required error={errors.startDate}>
        <DatePicker
          id="startDate"
          value={data.startDate}
          onChange={(startDate) => onChange({ startDate })}
        />
      </Field>
      <Field
        label={t("numberOfDays")}
        htmlFor="numberOfDays"
        required
        error={errors.numberOfDays}
        hint={t("numberOfDaysHint")}
      >
        <Input
          id="numberOfDays"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={data.numberOfDays}
          onKeyDown={(e) => {
            // Blocks scientific-notation/sign/decimal characters a native
            // number input otherwise still accepts by keystroke — "Gün
            // sayı" is always a whole positive count of days.
            if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault()
          }}
          onChange={(e) => onChange({ numberOfDays: e.target.value })}
        />
      </Field>
      <Field label={t("reason")} htmlFor="reason" hint={t("reasonHint")} className="sm:col-span-2">
        <Textarea
          id="reason"
          rows={3}
          value={data.reason}
          onChange={(e) => onChange({ reason: e.target.value })}
        />
      </Field>
    </div>
  )
}
