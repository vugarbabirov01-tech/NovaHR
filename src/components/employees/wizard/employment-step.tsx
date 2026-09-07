"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { Field } from "@/components/common/field"
import { FormSection } from "@/components/common/form-section"
import { SearchableSelect } from "@/components/common/searchable-select"
import { EnumSelect } from "@/components/common/enum-select"
import { MasterDataQuickActions } from "@/components/employees/wizard/master-data-quick-actions"
import { AddDepartmentDialog } from "@/components/master-data/add-department-dialog"
import { PositionFormDialog } from "@/components/master-data/position-form-dialog"
import { CompanyFormDialog } from "@/components/master-data/company-form-dialog"
import { WorkScheduleFormDialog } from "@/components/master-data/work-schedule-form-dialog"
import { createDepartmentAction } from "@/app/[locale]/(app)/departments/actions"
import { createPositionAction } from "@/app/[locale]/(app)/positions/actions"
import { createCompanyAction } from "@/app/[locale]/(app)/companies/actions"
import { createWorkScheduleAction } from "@/app/[locale]/(app)/work-schedules/actions"
import { CUSTOM_WORK_SCHEDULE_ID } from "@/lib/employee-wizard-mapper"
import {
  contractTypeMessageKeys,
  employmentTypeMessageKeys,
  workLocationTypeMessageKeys,
} from "@/lib/employees"
import type { WizardValidationErrors } from "@/lib/employee-wizard-validation"
import type { EmployeeWizardData } from "@/types/employee-wizard"
import type { WizardMasterData } from "@/lib/employee-wizard-mapper"
import type { DepartmentInput } from "@/repositories/department-repository"
import type { PositionInput } from "@/repositories/position-repository"
import type { CompanyInput } from "@/repositories/company-repository"
import type { WorkScheduleInput } from "@/repositories/work-schedule-repository"

interface StepProps {
  data: EmployeeWizardData
  onChange: (patch: Partial<EmployeeWizardData>) => void
  errors?: WizardValidationErrors
  masterData: WizardMasterData
  mode?: "create" | "edit"
  onAddDepartment: (department: WizardMasterData["departments"][number]) => void
  onAddPosition: (position: WizardMasterData["positions"][number]) => void
  onAddCompany: (company: WizardMasterData["companies"][number]) => void
  onAddWorkSchedule: (schedule: WizardMasterData["workSchedules"][number]) => void
}

type QuickCreateEntity = "department" | "position" | "company" | "workSchedule"

export function EmploymentStep({
  data,
  onChange,
  errors = {},
  masterData,
  mode = "create",
  onAddDepartment,
  onAddPosition,
  onAddCompany,
  onAddWorkSchedule,
}: StepProps) {
  const t = useTranslations("Employees.profile.employment")
  const tTabs = useTranslations("Employees.profile.tabs")
  const tType = useTranslations("EmploymentType")
  const tContract = useTranslations("ContractType")
  const tLocation = useTranslations("WorkLocationType")
  const tCommon = useTranslations("Common")
  const tWizard = useTranslations("Employees.wizard")

  // Every list here is a read-only snapshot the wizard's server page already
  // fetched from Administration — the wizard never queries or mutates
  // master data itself, only Administration pages create/edit/archive it.
  // The Quick Create modals below are the one exception: they call the
  // exact same Server Actions Administration uses, then append the result
  // to this snapshot so the Select updates without a page refresh.
  const { departments, positions, companies, workSchedules, managers } = masterData

  const availablePositions = positions.filter((position) => position.departmentId === data.departmentId)
  const isCustomSchedule = data.scheduleId === CUSTOM_WORK_SCHEDULE_ID

  const [activeDialog, setActiveDialog] = useState<QuickCreateEntity | null>(null)
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null)
  const [isCreating, startCreateTransition] = useTransition()

  function closeQuickCreate() {
    setActiveDialog(null)
    setQuickCreateError(null)
  }

  function handleCreateDepartment(input: DepartmentInput) {
    setQuickCreateError(null)
    startCreateTransition(async () => {
      const result = await createDepartmentAction(input)
      if (result.success && result.data) {
        onAddDepartment({ id: result.data.id, name: result.data.name })
        onChange({ departmentId: result.data.id, positionId: "" })
        closeQuickCreate()
      } else {
        setQuickCreateError(result.error ?? tCommon("genericError"))
      }
    })
  }

  function handleCreatePosition(input: PositionInput) {
    setQuickCreateError(null)
    startCreateTransition(async () => {
      const result = await createPositionAction(input)
      if (result.success && result.data) {
        onAddPosition({
          id: result.data.id,
          title: result.data.title,
          departmentId: result.data.departmentId,
        })
        onChange({ departmentId: result.data.departmentId, positionId: result.data.id })
        closeQuickCreate()
      } else {
        setQuickCreateError(result.error ?? tCommon("genericError"))
      }
    })
  }

  function handleCreateCompany(input: CompanyInput) {
    setQuickCreateError(null)
    startCreateTransition(async () => {
      const result = await createCompanyAction(input)
      if (result.success && result.data) {
        onAddCompany({ id: result.data.id, name: result.data.name })
        onChange({ companyId: result.data.id })
        closeQuickCreate()
      } else {
        setQuickCreateError(result.error ?? tCommon("genericError"))
      }
    })
  }

  function handleCreateWorkSchedule(input: WorkScheduleInput) {
    setQuickCreateError(null)
    startCreateTransition(async () => {
      const result = await createWorkScheduleAction(input)
      if (result.success && result.data) {
        onAddWorkSchedule({ id: result.data.id, label: result.data.label })
        onChange({ scheduleId: result.data.id })
        closeQuickCreate()
      } else {
        setQuickCreateError(result.error ?? tCommon("genericError"))
      }
    })
  }

  return (
    <FormSection title={tTabs("employment")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t("employeeNumber")}
          htmlFor="employeeNumber"
          error={errors.employeeNumber}
          hint={
            errors.employeeNumber
              ? undefined
              : mode === "edit"
                ? t("employeeNumberLockedHint")
                : t("employeeNumberHint")
          }
        >
          <Input
            id="employeeNumber"
            value={data.employeeNumber}
            onChange={(e) => onChange({ employeeNumber: e.target.value })}
            placeholder={t("employeeNumberPlaceholder")}
            disabled={mode === "edit"}
          />
        </Field>
        <Field label={t("hireDate")} htmlFor="hireDate" required error={errors.hireDate}>
          <Input
            id="hireDate"
            type="date"
            value={data.hireDate}
            onChange={(e) => onChange({ hireDate: e.target.value })}
          />
        </Field>
        <Field label={t("probationEndDate")} htmlFor="probationEndDate">
          <Input
            id="probationEndDate"
            type="date"
            value={data.probationEndDate}
            onChange={(e) => onChange({ probationEndDate: e.target.value })}
          />
        </Field>
        <Field label={t("employmentType")} htmlFor="employmentType" required error={errors.employmentType}>
          <EnumSelect
            id="employmentType"
            value={data.employmentType}
            onValueChange={(v) => onChange({ employmentType: v as EmployeeWizardData["employmentType"] })}
            options={(["full-time", "part-time", "seasonal", "temporary", "contract", "internship"] as const).map(
              (type) => ({ value: type, label: tType(employmentTypeMessageKeys[type]) })
            )}
            placeholder={tCommon("selectPlaceholder")}
          />
        </Field>
        <Field label={t("contractType")} htmlFor="contractType" required error={errors.contractType}>
          <EnumSelect
            id="contractType"
            value={data.contractType}
            onValueChange={(v) => onChange({ contractType: v as EmployeeWizardData["contractType"] })}
            options={(["permanent", "fixed-term", "project-based", "internship"] as const).map((type) => ({
              value: type,
              label: tContract(contractTypeMessageKeys[type]),
            }))}
            placeholder={tCommon("selectPlaceholder")}
          />
        </Field>

        {/* Department → Position. Read-only consumption of Administration
            master data, plus a Quick Create modal that calls the same
            Server Action Administration uses — the wizard never edits,
            archives, restores or lists these records itself. */}
        <Field label={t("department")} htmlFor="departmentId" required error={errors.departmentId}>
          <div className="flex items-center gap-1.5">
            <SearchableSelect
              id="departmentId"
              className="flex-1"
              value={data.departmentId}
              onValueChange={(departmentId) => onChange({ departmentId, positionId: "" })}
              options={departments.map((department) => ({ value: department.id, label: department.name }))}
              placeholder={tCommon("selectPlaceholder")}
              searchPlaceholder={tCommon("searchPlaceholder")}
              emptyText={tCommon("noResults")}
            />
            <MasterDataQuickActions
              onAdd={() => setActiveDialog("department")}
              manageHref="/departments"
              addLabel={tWizard("quickCreate.addTooltip", { entity: t("department") })}
              manageLabel={tWizard("quickCreate.manageTooltip", { entity: t("department") })}
            />
          </div>
        </Field>
        <Field label={t("position")} htmlFor="positionId" required error={errors.positionId}>
          <div className="flex items-center gap-1.5">
            <SearchableSelect
              id="positionId"
              className="flex-1"
              value={data.positionId}
              onValueChange={(positionId) => onChange({ positionId })}
              options={availablePositions.map((position) => ({ value: position.id, label: position.title }))}
              placeholder={data.departmentId ? tCommon("selectPlaceholder") : t("selectDepartmentFirst")}
              searchPlaceholder={tCommon("searchPlaceholder")}
              emptyText={tCommon("noResults")}
              disabled={!data.departmentId}
            />
            <MasterDataQuickActions
              onAdd={() => setActiveDialog("position")}
              manageHref="/positions"
              addLabel={tWizard("quickCreate.addTooltip", { entity: t("position") })}
              manageLabel={tWizard("quickCreate.manageTooltip", { entity: t("position") })}
            />
          </div>
        </Field>

        <Field label={t("company")} htmlFor="companyId" required error={errors.companyId}>
          <div className="flex items-center gap-1.5">
            <SearchableSelect
              id="companyId"
              className="flex-1"
              value={data.companyId}
              onValueChange={(companyId) => onChange({ companyId })}
              options={companies.map((company) => ({ value: company.id, label: company.name }))}
              placeholder={tCommon("selectPlaceholder")}
              searchPlaceholder={tCommon("searchPlaceholder")}
              emptyText={tCommon("noResults")}
            />
            <MasterDataQuickActions
              onAdd={() => setActiveDialog("company")}
              manageHref="/companies"
              addLabel={tWizard("quickCreate.addTooltip", { entity: t("company") })}
              manageLabel={tWizard("quickCreate.manageTooltip", { entity: t("company") })}
            />
          </div>
        </Field>

        <Field label={t("workLocationType")} htmlFor="workLocationType" required error={errors.workLocationType}>
          <EnumSelect
            id="workLocationType"
            value={data.workLocationType}
            onValueChange={(v) => onChange({ workLocationType: v as EmployeeWizardData["workLocationType"] })}
            options={(["on-site", "remote", "hybrid"] as const).map((type) => ({
              value: type,
              label: tLocation(workLocationTypeMessageKeys[type]),
            }))}
            placeholder={tCommon("selectPlaceholder")}
          />
        </Field>
        <Field label={t("workLocation")} htmlFor="workLocation">
          <Input
            id="workLocation"
            value={data.workLocation}
            onChange={(e) => onChange({ workLocation: e.target.value })}
          />
        </Field>

        <Field label={t("manager")} htmlFor="managerId">
          <SearchableSelect
            id="managerId"
            value={data.managerId}
            onValueChange={(managerId) => onChange({ managerId })}
            options={managers.map((manager) => ({ value: manager.id, label: manager.name }))}
            placeholder={tCommon("selectPlaceholder")}
            searchPlaceholder={t("managerSearchPlaceholder")}
            emptyText={t("noManagersFound")}
          />
        </Field>

        <Field label={t("workSchedule")} htmlFor="scheduleId">
          <div className="flex items-center gap-1.5">
            <SearchableSelect
              id="scheduleId"
              className="flex-1"
              value={data.scheduleId}
              onValueChange={(scheduleId) => onChange({ scheduleId })}
              options={workSchedules.map((schedule) => ({ value: schedule.id, label: schedule.label }))}
              placeholder={tCommon("selectPlaceholder")}
              searchPlaceholder={tCommon("searchPlaceholder")}
              emptyText={tCommon("noResults")}
            />
            <MasterDataQuickActions
              onAdd={() => setActiveDialog("workSchedule")}
              manageHref="/work-schedules"
              addLabel={tWizard("quickCreate.addTooltip", { entity: t("workSchedule") })}
              manageLabel={tWizard("quickCreate.manageTooltip", { entity: t("workSchedule") })}
            />
          </div>
        </Field>
        {isCustomSchedule ? (
          <Field label={t("customWorkSchedule")} htmlFor="customWorkScheduleLabel">
            <Input
              id="customWorkScheduleLabel"
              value={data.customWorkScheduleLabel}
              onChange={(e) => onChange({ customWorkScheduleLabel: e.target.value })}
              placeholder={t("customWorkSchedulePlaceholder")}
            />
          </Field>
        ) : null}
      </div>

      {/* Quick Create modals — create-only, no tables, no archive/edit/delete.
          Each reuses the exact dialog + Server Action Administration uses. */}
      <AddDepartmentDialog
        open={activeDialog === "department"}
        onOpenChange={(open) => !open && closeQuickCreate()}
        onSubmit={handleCreateDepartment}
        isSaving={isCreating}
      />
      <PositionFormDialog
        open={activeDialog === "position"}
        onOpenChange={(open) => !open && closeQuickCreate()}
        onSubmit={handleCreatePosition}
        isSaving={isCreating}
        departments={departments}
        defaultDepartmentId={data.departmentId}
      />
      <CompanyFormDialog
        open={activeDialog === "company"}
        onOpenChange={(open) => !open && closeQuickCreate()}
        onSubmit={handleCreateCompany}
        isSaving={isCreating}
      />
      <WorkScheduleFormDialog
        open={activeDialog === "workSchedule"}
        onOpenChange={(open) => !open && closeQuickCreate()}
        onSubmit={handleCreateWorkSchedule}
        isSaving={isCreating}
      />
      {quickCreateError ? <p className="text-xs text-destructive">{quickCreateError}</p> : null}
    </FormSection>
  )
}
