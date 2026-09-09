import type {
  ContractType,
  EmploymentType,
  Gender,
  MaritalStatus,
  WorkLocationType,
} from "@/types/employee-profile"
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
  manager: { az: "Rəhbər", en: "Manager", ru: "Руководитель" },
  workSchedule: { az: "İş Qrafiki", en: "Work Schedule", ru: "График работы" },
  workLocationType: { az: "İşin İcra Yeri", en: "Work Location Type", ru: "Тип места работы" },
  workLocation: { az: "İş Yeri", en: "Work Location", ru: "Место работы" },
  salary: { az: "Maaş", en: "Salary", ru: "Зарплата" },
  salaryStartDate: { az: "Maaşın başlanma tarixi", en: "Salary Start Date", ru: "Дата начала выплаты зарплаты" },
}

/**
 * The file format's fixed CELL-VALUE vocabulary for the five importable
 * fields whose underlying value is a closed enum rather than free text —
 * same "independent of next-intl, Azerbaijan-market-only" reasoning as
 * FIELD_LABELS above, and same AZ wording the app's own UI already shows
 * for these exact values (messages/az.json's Gender/MaritalStatus/
 * EmploymentType/ContractType/WorkLocationType namespaces), duplicated here
 * deliberately rather than imported so the file format never depends on
 * next-intl. profile-to-export-row.ts writes these labels into
 * Import-Template/Full-Report cells instead of the raw internal code
 * ("male", "full-time", ...); row-mapper.ts's enum maps recognize them
 * (case-insensitively) coming back in on Import, built from these same
 * tables so the two directions can never drift apart.
 */
export const GENDER_VALUE_LABELS: Record<Gender, string> = {
  male: "Kişi",
  female: "Qadın",
}

export const MARITAL_STATUS_VALUE_LABELS: Record<MaritalStatus, string> = {
  single: "Subay",
  married: "Evli",
  divorced: "Boşanmış",
  widowed: "Dul",
}

export const EMPLOYMENT_TYPE_VALUE_LABELS: Record<EmploymentType, string> = {
  "full-time": "Tam ştat",
  "part-time": "Yarım ştat",
  seasonal: "Mövsümi",
  temporary: "Müvəqqəti",
  contract: "Müqavilə əsaslı",
  internship: "Təcrübə (stajor)",
}

export const CONTRACT_TYPE_VALUE_LABELS: Record<ContractType, string> = {
  permanent: "Müddətsiz",
  "fixed-term": "Müddətli",
  "project-based": "Layihə əsaslı",
  internship: "Təcrübə müqaviləsi",
}

export const WORK_LOCATION_TYPE_VALUE_LABELS: Record<WorkLocationType, string> = {
  "on-site": "Ofisdən",
  remote: "Məsafədən",
  hybrid: "Hibrid iş rejimi",
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
  // The canonical label below is the plain-ASCII "FIN" Export has always
  // written — kept as-is so existing exported files keep round-tripping.
  // "FİN", with the correct Azerbaijani dotted İ, is the spelling real HR
  // spreadsheets actually use (including a salary-only sheet, which never
  // goes through Export at all) — normalize()'s locale-aware case-folding
  // means it can't be folded to the same string as "FIN" (İ and I fold
  // differently under az/tr rules), so it needs its own alias entry rather
  // than "just working" from the canonical label alone.
  finCode: ["FİN"],
  nationalId: ["id card", "seriya"],
  employeeNumber: ["emp no", "empno"],
  hireDate: ["start date"],
  passportNumber: ["passport"],
  position: ["title", "job title"],
  // "Əmək haqqı" is the wording HR actually uses for a salary-only import
  // sheet (as opposed to "Maaş", the full Employee Import template's own
  // canonical header) — recognized here so both templates map to the same
  // field without Salary Import needing its own alias table.
  salary: ["əmək haqqı", "emek haqqi", "amount"],
  salaryStartDate: ["qüvvəyə minmə tarixi", "quvveye minme tarixi", "effective date"],
}

/**
 * Plain .toLowerCase() mis-cases the Azerbaijani dotted capital İ — it
 * lowercases to "i" + a combining dot (2 codepoints) instead of plain "i",
 * so a real-world header spelled "FİN" (the linguistically correct
 * Azerbaijani spelling) would silently fail to match the "FIN" canonical
 * label. toLocaleLowerCase("az") applies Azerbaijani/Turkish case-folding
 * rules instead, where İ → i and I → ı case correctly — every plain-ASCII
 * header still normalizes identically either way.
 */
function normalize(text: string): string {
  return text.trim().toLocaleLowerCase("az").replace(/[\s_-]+/g, " ")
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
  "manager",
  "workSchedule",
  "workLocationType",
  "workLocation",
  "salary",
  "salaryStartDate",
]
