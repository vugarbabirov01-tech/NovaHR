/**
 * `.toLowerCase()` (no locale) gets Azerbaijani/Turkish casing wrong:
 * "İ".toLowerCase() → "i̇" (adds a combining dot instead of plain "i"), so
 * "İsmayılov".toLowerCase() would never match a query typed "ismayılov".
 * `.toLocaleLowerCase("az")` folds İ→i and I→ı correctly — verified
 * directly against this Node runtime before relying on it here. Every
 * value Global Search compares (the query and every field it searches)
 * goes through this one function, never a bare .toLowerCase().
 */
export function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase("az").trim()
}

/** Splits a query into whitespace-separated, normalized tokens — matching
 * is token-AND (every token must appear somewhere), not one contiguous
 * substring, so "Qismət Tahirov Əli" finds an employee whose stored field
 * order is lastName/firstName/fatherName, and "Qala Anbar" still matches
 * regardless of how the query itself is spaced. */
export function tokenize(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean)
}
