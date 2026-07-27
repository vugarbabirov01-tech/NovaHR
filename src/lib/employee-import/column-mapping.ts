import type { ImportableField } from "@/lib/employee-import/types"

/**
 * The file-format's header vocabulary — deliberately independent of the
 * app's next-intl UI locale. Nova HRMS's UI may show its own labels in
 * whatever language the user has selected, but the *file format* (what
 * Export writes and what Import expects to read back) is a fixed business
 * decision: Azerbaijan-market-only, headers always Azerbaijani.
 *
 * Extensibility for future markets/languages lives entirely in this one
 * table: adding a language means adding one more key per field here.
 * Nothing in row-validator.ts, row-mapper.ts, or the export builder needs
 * to change — they only ever ask this module "what field does this header
 * mean?" or "what's field X's header in language Y?".
 */
export type HeaderLocale = "az" | "en" | "ru"

export const DEFAULT_HEADER_LOCALE: HeaderLocale = "az"

export const FIELD_LABELS: Record<ImportableField, Record<HeaderLocale, string>> = {
  firstName: { az: "Ad", en: "First Name", ru: "Имя" },
  lastName: { az: "Soyad", en: "Last Name", ru: "Фамилия" },
  fatherName: { az: "Ata Adı", en: "Father's Name", ru: "Отчество" },
  gender: { az: "Cins", en: "Gender", ru: "Пол" },
  dateOfBirth: { az: "Doğum Tarixi", en: "Date of Birth", ru: "Дата рождения" },
  nationality: { az: "Vətəndaşlıq", en: "Nationality", ru: "Гражданство" },
  maritalStatus: { az: "Ailə Vəziyyəti", en: "Marital Status", ru: "Семейное положение" },
  finCode: { az: "FIN", en: "FIN", ru: "ФИН" },
  nationalId: { az: "Şəxsiyyət Vəsiqəsi", en: "National ID", ru: "Удостоверение личности" },
  passportNumber: { az: "Pasport Nömrəsi", en: "Passport Number", ru: "Номер паспорта" },
  address: { az: "Ünvan", en: "Address", ru: "Адрес" },
  phone: { az: "Telefon", en: "Phone", ru: "Телефон" },
  email: { az: "E-poçt", en: "Email", ru: "Email" },
  emergencyContactName: {
    az: "Təcili Əlaqə Şəxsi",
    en: "Emergency Contact Name",
    ru: "Контакт для экстренной связи (имя)",
  },
  emergencyContactPhone: {
    az: "Təcili Əlaqə Telefonu",
    en: "Emergency Contact Phone",
    ru: "Контакт для экстренной связи (телефон)",
  },
  emergencyContactRelation: {
    az: "Təcili Əlaqə Qohumluğu",
    en: "Emergency Contact Relation",
    ru: "Контакт для экстренной связи (родство)",
  },
  employeeNumber: { az: "Əməkdaş Nömrəsi", en: "Employee Number", ru: "Табельный номер" },
  hireDate: { az: "İşə Qəbul Tarixi", en: "Hire Date", ru: "Дата найма" },
  probationEndDate: {
    az: "Sınaq Müddətinin Bitmə Tarixi",
    en: "Probation End Date",
    ru: "Дата окончания испытательного срока",
  },
  employmentType: { az: "Məşğulluq Növü", en: "Employment Type", ru: "Тип занятости" },
  contractType: { az: "Müqavilə Növü", en: "Contract Type", ru: "Тип договора" },
  department: { az: "Şöbə", en: "Department", ru: "Отдел" },
  position: { az: "Vəzifə", en: "Position", ru: "Должность" },
  company: { az: "Şirkət", en: "Company", ru: "Компания" },
  branch: { az: "Filial", en: "Branch", ru: "Филиал" },
  manager: { az: "Rəhbər", en: "Manager", ru: "Руководитель" },
  workSchedule: { az: "İş Qrafiki", en: "Work Schedule", ru: "График работы" },
  workLocationType: { az: "İşin İcra Yeri", en: "Work Location Type", ru: "Тип места работы" },
  workLocation: { az: "İş Yeri", en: "Work Location", ru: "Место работы" },
}

/**
 * Loose extra aliases (abbreviations, common alternate phrasings) that
 * aren't any language's canonical label but are still worth recognizing on
 * incoming files from varied sources. Purely additive to FIELD_LABELS —
 * removing this const entirely would not break round-trip compatibility.
 */
const EXTRA_ALIASES: Partial<Record<ImportableField, string[]>> = {
  gender: ["sex", "m", "f", "kişi", "qadın"],
  dateOfBirth: ["dob"],
  nationalId: ["id card", "seriya"],
  employeeNumber: ["emp no", "empno"],
  hireDate: ["start date"],
  passportNumber: ["passport"],
  position: ["title", "job title"],
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_-]+/g, " ")
}

/** The canonical header text for a field — what Export writes and what Import's UI shows as the "detected" label. */
export function getFieldHeaderLabel(field: ImportableField, locale: HeaderLocale = DEFAULT_HEADER_LOCALE): string {
  return FIELD_LABELS[field][locale]
}

/** Best-guess field for a raw column header — undefined means "leave unmapped". */
export function suggestFieldForColumn(header: string): ImportableField | undefined {
  const normalized = normalize(header)

  for (const [field, labels] of Object.entries(FIELD_LABELS) as [ImportableField, Record<HeaderLocale, string>][]) {
    if (Object.values(labels).some((label) => normalize(label) === normalized)) {
      return field
    }
  }

  for (const [field, aliases] of Object.entries(EXTRA_ALIASES) as [ImportableField, string[]][]) {
    if (aliases.some((alias) => normalize(alias) === normalized)) {
      return field
    }
  }

  return undefined
}

export const IMPORTABLE_FIELD_ORDER: ImportableField[] = [
  "firstName",
  "lastName",
  "fatherName",
  "gender",
  "dateOfBirth",
  "nationality",
  "maritalStatus",
  "finCode",
  "nationalId",
  "passportNumber",
  "phone",
  "email",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
  "employeeNumber",
  "hireDate",
  "probationEndDate",
  "employmentType",
  "contractType",
  "department",
  "position",
  "company",
  "branch",
  "manager",
  "workSchedule",
  "workLocationType",
  "workLocation",
]
