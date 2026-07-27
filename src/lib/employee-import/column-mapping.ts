import type { ImportableField } from "@/lib/employee-import/types"

/**
 * Synonyms (English/Azerbaijani/Russian — the app's three locales) used to
 * auto-suggest a mapping for each detected column header. Matching is
 * normalized (lowercased, punctuation/whitespace stripped) so "First Name",
 * "first_name" and "Ad" all resolve the same way.
 */
const FIELD_SYNONYMS: Record<ImportableField, string[]> = {
  firstName: ["firstname", "first name", "ad", "имя"],
  lastName: ["lastname", "last name", "surname", "soyad", "фамилия"],
  fatherName: ["fathername", "father name", "ata adı", "ataadi", "отчество"],
  gender: ["gender", "sex", "cins", "cinsiyyet", "пол"],
  dateOfBirth: ["dateofbirth", "date of birth", "dob", "doğum tarixi", "dogum tarixi", "дата рождения"],
  nationality: ["nationality", "vətəndaşlıq", "vetendashliq", "гражданство"],
  maritalStatus: ["maritalstatus", "marital status", "ailə vəziyyəti", "aile veziyyeti", "семейное положение"],
  finCode: ["fin", "fincode", "fin kod", "fin kodu", "фин", "фин код"],
  nationalId: ["nationalid", "national id", "id card", "şəxsiyyət vəsiqəsi", "seriya", "id номер"],
  passportNumber: ["passportnumber", "passport number", "passport", "pasport", "паспорт"],
  address: ["address", "ünvan", "unvan", "адрес"],
  phone: ["phone", "phonenumber", "phone number", "mobile", "telefon", "телефон"],
  email: ["email", "e-mail", "email address", "elektron poçt", "электронная почта"],
  emergencyContactName: [
    "emergencycontactname",
    "emergency contact name",
    "təcili əlaqə şəxsi",
    "контакт для экстренной связи",
  ],
  emergencyContactPhone: ["emergencycontactphone", "emergency contact phone", "təcili əlaqə telefonu"],
  emergencyContactRelation: ["emergencycontactrelation", "emergency contact relation", "qohumluq"],
  employeeNumber: ["employeenumber", "employee number", "emp no", "empno", "əməkdaş nömrəsi", "табельный номер"],
  hireDate: ["hiredate", "hire date", "start date", "işə qəbul tarixi", "ise qebul tarixi", "дата найма"],
  probationEndDate: ["probationenddate", "probation end date", "sınaq müddəti", "испытательный срок"],
  employmentType: ["employmenttype", "employment type", "məşğulluq növü", "тип занятости"],
  contractType: ["contracttype", "contract type", "müqavilə növü", "тип договора"],
  department: ["department", "şöbə", "shobe", "отдел"],
  position: ["position", "title", "job title", "vəzifə", "vezife", "должность"],
  company: ["company", "şirkət", "sirket", "компания"],
  branch: ["branch", "filial", "филиал"],
  manager: ["manager", "rəhbər", "rehber", "руководитель"],
  workSchedule: ["workschedule", "work schedule", "iş qrafiki", "is qrafiki", "график работы"],
  workLocationType: ["worklocationtype", "work location type", "işin icra yeri", "тип места работы"],
  workLocation: ["worklocation", "work location", "office", "iş yeri", "место работы"],
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_-]+/g, " ")
}

/** Best-guess field for a raw column header — undefined means "leave unmapped". */
export function suggestFieldForColumn(header: string): ImportableField | undefined {
  const normalized = normalize(header)
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS) as [ImportableField, string[]][]) {
    if (synonyms.some((synonym) => normalize(synonym) === normalized)) {
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
