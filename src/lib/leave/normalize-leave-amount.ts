/**
 * The one place a leave amount is normalized before it's stored, summed, or
 * rendered. `-0` is a distinct IEEE-754 value from `0` (`-(0)`, `0 * -1`, and
 * `total - total` when total is negative-of-itself can all produce it), and
 * it renders as the literal string "-0" wherever it's templated or passed
 * to a number formatter — every leave balance surface in the app (Employee
 * Profile, org dashboard, the request wizard's Review step) computes
 * through leave-balance-service.ts, and that's where this gets applied, so
 * no individual component should ever need to re-derive this rule itself.
 */
export function normalizeLeaveAmount(value: number): number {
  return value === 0 ? 0 : value
}
