import type { ImportableField } from "@/lib/employee-import/types"

/**
 * Every user-facing string the Import Wizard's validation pipeline
 * produces — Nova HRMS is built exclusively for the Azerbaijan market, so
 * these are fixed Azerbaijani business language, independent of whatever
 * locale the app's UI chrome happens to be in (the same decision already
 * made for Export/Import file headers in FIELD_LABELS). Centralizing every
 * message here means row-mapper.ts, row-validator.ts and the worker never
 * construct user-facing text themselves — only pick a function from this
 * catalog and pass it the raw value.
 *
 * A field's name here is deliberately its own catalog, separate from
 * FIELD_LABELS (which is Title Case, meant for column headers/UI labels).
 * Mid-sentence Azerbaijani reads more naturally with only the sentence's
 * own first word capitalized — "FIN kodu daxil edilməlidir.", not
 * "FIN Kodu daxil edilməlidir." — so the two registries intentionally
 * diverge in casing/register even where the underlying word is the same.
 */
const VALIDATION_FIELD_LABELS: Record<ImportableField, string> = {
  firstName: "Ad",
  lastName: "Soyad",
  fatherName: "Ata adı",
  gender: "Cins",
  dateOfBirth: "Doğum tarixi",
  nationality: "Vətəndaşlıq",
  maritalStatus: "Ailə vəziyyəti",
  finCode: "FIN kodu",
  nationalId: "Şəxsiyyət vəsiqəsi",
  passportNumber: "Pasport nömrəsi",
  address: "Ünvan",
  phone: "Telefon",
  email: "E-poçt",
  emergencyContactName: "Təcili əlaqə şəxsi",
  emergencyContactPhone: "Təcili əlaqə telefonu",
  emergencyContactRelation: "Təcili əlaqə qohumluğu",
  employeeNumber: "Əməkdaş nömrəsi",
  hireDate: "İşə qəbul tarixi",
  probationEndDate: "Sınaq müddətinin bitmə tarixi",
  employmentType: "Məşğulluq növü",
  contractType: "Müqavilə növü",
  department: "Şöbə",
  position: "Vəzifə",
  company: "Şirkət",
  branch: "Filial",
  manager: "Rəhbər",
  workSchedule: "İş qrafiki",
  workLocationType: "İşin icra yeri",
  workLocation: "İş yeri",
}

/**
 * validateWizardStep (reused unmodified from Employee Create/Edit) returns
 * errors keyed by EmployeeWizardData's own property names — which for the
 * cascading master-data fields are the *id* fields (departmentId,
 * positionId, companyId, branchId), not the plain-text ImportableFields
 * (department, position, company, branch) Import's own vocabulary uses.
 * This bridges the two so every field, however it's keyed, resolves to
 * the same business name.
 */
const WIZARD_VALIDATION_FIELD_TO_IMPORTABLE_FIELD: Record<string, ImportableField> = {
  firstName: "firstName",
  lastName: "lastName",
  fatherName: "fatherName",
  gender: "gender",
  dateOfBirth: "dateOfBirth",
  finCode: "finCode",
  phone: "phone",
  email: "email",
  hireDate: "hireDate",
  employmentType: "employmentType",
  contractType: "contractType",
  departmentId: "department",
  positionId: "position",
  companyId: "company",
  branchId: "branch",
  workLocationType: "workLocationType",
}

function labelForWizardField(wizardFieldKey: string): string {
  const importableField = WIZARD_VALIDATION_FIELD_TO_IMPORTABLE_FIELD[wizardFieldKey]
  // Every key validateWizardStep(0)/validateWizardStep(1) can produce is
  // covered by the map above; this is just a safe fallback, never expected
  // to actually be hit.
  return importableField ? VALIDATION_FIELD_LABELS[importableField] : wizardFieldKey
}

export const ImportValidationMessages = {
  requiredField: (wizardFieldKey: string) => `${labelForWizardField(wizardFieldKey)} daxil edilməlidir.`,

  invalidDate: (field: "dateOfBirth" | "hireDate", rawValue: string) =>
    `${VALIDATION_FIELD_LABELS[field]} "${rawValue}" düzgün formatda deyil.`,

  valueNormalized: (field: ImportableField, original: string, normalized: string) =>
    `${VALIDATION_FIELD_LABELS[field]}: "${original}" dəyəri "${normalized}" formatına gətirildi.`,

  departmentNotFound: (value: string) => `Şöbə "${value}" sistemdə tapılmadı.`,

  positionNotFound: (value: string, scopedToDepartment: boolean) =>
    `Vəzifə "${value}" ${scopedToDepartment ? "seçilmiş şöbədə" : "sistemdə"} tapılmadı.`,

  companyNotFound: (value: string) => `Şirkət "${value}" sistemdə tapılmadı.`,

  branchNotFound: (value: string, scopedToCompany: boolean) =>
    `Filial "${value}" ${scopedToCompany ? "seçilmiş şirkətdə" : "sistemdə"} tapılmadı.`,

  managerNotFound: (value: string) => `Rəhbər "${value}" sistemdə tapılmadı.`,

  workScheduleCustom: (value: string) =>
    `İş qrafiki "${value}" sistemdə tapılmadı. Bu sətir üçün fərdi iş qrafiki istifadə olunacaq.`,

  duplicateFinInFile: (value: string) => `FIN kodu "${value}" bu fayl daxilində birdən çox dəfə istifadə olunub.`,

  duplicateFinExisting: (value: string) =>
    `FIN kodu "${value}" olan əməkdaş artıq sistemdə mövcuddur — bu sətir keçiriləcək.`,

  employeeNumberGenerated: (value: string) => `Əməkdaş nömrəsi avtomatik yaradıldı: ${value}.`,

  duplicateEmployeeNumberInFile: (value: string) =>
    `Əməkdaş nömrəsi "${value}" bu fayl daxilində birdən çox dəfə istifadə olunub.`,

  duplicateEmployeeNumberExisting: (value: string) => `Əməkdaş nömrəsi "${value}" artıq sistemdə mövcuddur.`,

  noFileParsedYet: "Fayl hələ oxunmayıb.",

  unknownWorkerError: "Fayl emal edilərkən naməlum xəta baş verdi.",
}
