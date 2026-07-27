import type {
  DisabilityGroup,
  EmploymentStatus,
  ProfessionalCategory,
  VeteranStatus,
} from "@/types/employee-profile"

/**
 * Columns that only exist in the "Full Employee Report" export type — never
 * part of IMPORTABLE_FIELD_ORDER, never recognized by Import. Kept in a
 * separate module from column-mapping.ts on purpose: that file's registry
 * is scoped strictly to the round-trip-compatible field set.
 */
export type ReportOnlyField =
  | "employmentStatus"
  | "grade"
  | "age"
  | "totalWorkExperience"
  | "professionalCategory"
  | "veteranStatus"
  | "hasDisability"
  | "disabilityGroup"
  | "baseSalary"
  | "currency"

export const REPORT_ONLY_FIELD_ORDER: ReportOnlyField[] = [
  "employmentStatus",
  "grade",
  "age",
  "totalWorkExperience",
  "professionalCategory",
  "veteranStatus",
  "hasDisability",
  "disabilityGroup",
  "baseSalary",
  "currency",
]

export const REPORT_ONLY_FIELD_LABELS: Record<ReportOnlyField, string> = {
  employmentStatus: "Status",
  grade: "Dərəcə",
  age: "Yaş",
  totalWorkExperience: "Ümumi İş Stajı",
  professionalCategory: "Peşə Kateqoriyası",
  veteranStatus: "Veteran Statusu",
  hasDisability: "Əlilliyi Var",
  disabilityGroup: "Əlillik Qrupu",
  baseSalary: "Əsas Maaş",
  currency: "Valyuta",
}

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: "Aktiv",
  probation: "Sınaq Müddətində",
  "on-leave": "Məzuniyyətdə",
  suspended: "Dayandırılıb",
  terminated: "İşdən Çıxarılıb",
  inactive: "Qeyri-aktiv",
}

export const PROFESSIONAL_CATEGORY_LABELS: Record<ProfessionalCategory, string> = {
  civilServant: "Dövlət Qulluqçusu",
  judge: "Hakim",
  prosecutor: "Prokuror",
  academicStaff: "Elmi-Pedaqoji İşçi",
  medicalStaff: "Tibb İşçisi",
}

export const VETERAN_STATUS_LABELS: Record<VeteranStatus, string> = {
  warVeteran: "Müharibə Veteranı",
  combatParticipant: "Döyüş İştirakçısı",
  liberatedTerritoriesSpecialist: "Azad Edilmiş Ərazilərdə Çalışan Mütəxəssis",
  stateDecorationHolder: "Dövlət Təltifi Sahibi",
}

export const DISABILITY_GROUP_LABELS: Record<DisabilityGroup, string> = {
  I: "I Qrup",
  II: "II Qrup",
  III: "III Qrup",
}
