/**
 * The one matching key used everywhere a reference-data name (Position,
 * Company, Department, Branch, Manager, Work Schedule) is compared for
 * "is this the same thing that already exists" — Import auto-create,
 * master-data-resolver's lookups, anywhere else that needs it. Never
 * stored, only used as a comparison key, so tightening it later can't
 * corrupt data that's already saved.
 *
 * NFC first so precomposed and decomposed forms of the same Azerbaijani
 * letter (ə/ö/ü/ş/ç/ğ, dotted İ/i vs dotless I/ı) compare equal regardless
 * of which one a given Excel file happens to encode. toLocaleLowerCase("az")
 * — not the default toLowerCase() — is what keeps Turkic dotless-I casing
 * correct (plain toLowerCase() would map "I" to "i", not "ı", corrupting
 * the very letters this function exists to handle).
 */
export function normalizeReferenceName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("az")
}
