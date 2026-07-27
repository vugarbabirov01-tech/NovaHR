export const departments = [
  "Engineering",
  "Design",
  "Sales",
  "Finance",
  "Human Resources",
  "Operations",
  "Marketing",
  "Legal",
  "Customer Success",
] as const

export const positions = [
  "Senior Product Designer",
  "Backend Engineer",
  "Talent Acquisition Lead",
  "Senior Financial Analyst",
  "Account Executive",
  "DevOps Engineer",
  "IT Support Specialist",
  "Customer Success Specialist",
  "Warehouse Technician",
  "Marketing Specialist",
  "Engineering Manager",
  "Legal Counsel",
] as const

export const grades = [
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
] as const

// Grades live in the Organization Structure module and are assigned per
// Position there. The registration wizard looks up this map instead of
// letting HR pick a grade by hand, so list/profile grade is always
// consistent with the org structure's source of truth.
export const positionGrades: Record<(typeof positions)[number], (typeof grades)[number]> = {
  "Warehouse Technician": "G1",
  "IT Support Specialist": "G2",
  "Customer Success Specialist": "G2",
  "Marketing Specialist": "G2",
  "Account Executive": "G3",
  "Senior Financial Analyst": "G4",
  "Senior Product Designer": "G4",
  "Backend Engineer": "G4",
  "DevOps Engineer": "G4",
  "Legal Counsel": "G5",
  "Talent Acquisition Lead": "G5",
  "Engineering Manager": "G6",
}

export const branches = [
  "Baku HQ",
  "Ganja Branch",
  "Sumgait Branch",
  "Remote",
] as const

export const workLocations = [
  "Nərimanov Office",
  "Heydar Aliyev Center",
  "Baku Palace",
  "Olympic Residence",
  "Head Office",
  "Ganja Office",
  "Sumgait Warehouse",
  "Remote",
] as const

export const companies = ["Nova Group LLC"] as const

export const currencies = ["AZN", "USD", "EUR"] as const
