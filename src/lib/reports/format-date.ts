/**
 * Display form of a stored ISO date: "1954-05-15" (or a full ISO timestamp)
 * -> "15.05.1954" (gün.ay.il). Anything that isn't an ISO date is returned
 * unchanged, so a bad value is shown as-is instead of hidden.
 */
export function formatReportDate(value: string | number): string {
  const text = String(value)
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : text
}
