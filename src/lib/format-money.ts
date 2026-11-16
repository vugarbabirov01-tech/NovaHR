const SYMBOLS: Record<string, string> = { AZN: "₼", USD: "$", EUR: "€", RUB: "₽", TRY: "₺", GBP: "£" }

/**
 * Deterministic money formatting. `Intl.NumberFormat("az", { style: "currency" })`
 * renders "AZN 931.00" on a Node build without full ICU but "931,00 ₼" in the
 * browser, which breaks hydration. This produces the same string everywhere:
 * "1 234,50 ₼" (space thousands, comma decimals, symbol after).
 */
export function formatMoney(amount: number, currency: string): string {
  const [whole, fraction] = Math.abs(amount).toFixed(2).split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  const sign = amount < 0 ? "-" : ""
  return `${sign}${grouped},${fraction} ${SYMBOLS[currency] ?? currency}`
}
