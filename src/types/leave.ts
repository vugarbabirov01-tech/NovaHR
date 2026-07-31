// Leave Management — derived-only types. Everything here has no Prisma
// equivalent because it's always computed, never stored: Prisma-backed
// entities (LeaveType, LeavePolicy, LeaveRequest, LeaveLedgerEntry, ...) are
// consumed by re-exporting the generated model type directly from each
// repository (e.g. `export type { LeaveTypeModel as LeaveType }` in
// leave-type-repository.ts), the same way company-repository.ts does today
// — not duplicated as a hand-written interface here.

/**
 * The reconstructed balance for one employee + leave type, as of a given
 * date — always a SUM() projection over LeaveLedgerEntry rows, never a
 * stored column. Computed by computeLeaveBalance() in
 * src/lib/leave/leave-balance-service.ts — the only place that turns raw
 * ledger rows into this shape; nothing else recomputes it. The eventual real
 * LeaveProvider implementation (still MockLeaveProvider today) maps from
 * this type when it's built.
 */
export interface LeaveBalanceStatement {
  employeeId: string
  leaveTypeId: string
  asOfDate: string
  /** SUM(OPENING_BALANCE + IMPORTED_BALANCE) ledger rows — unless no such
   * row has ever been recorded for this employee/type, in which case this
   * falls back to the employee's computed entitlement (ANNUAL leave only,
   * from resolveAnnualLeaveEntitlement — see computeLeaveBalance). Real
   * ledger data always wins over the computed fallback; the fallback only
   * fills the gap before an opening balance has actually been imported. */
  opening: number
  accrued: number
  carriedForward: number
  taken: number
  adjusted: number
  expired: number
  settled: number
  encashed: number
  /** The authoritative figure — always the raw SUM(amount) over every
   * ledger row (plus the same entitlement fallback `opening` uses, kept in
   * sync so the two never disagree), computed independently of the display
   * buckets above (which are sign-flipped for readability and must never
   * be re-summed to derive this). If this and a hand re-sum of the buckets
   * ever disagree, this value is the one that's correct. */
  remaining: number
  /** SUM(requestedUnits) of this employee's PENDING_APPROVAL LeaveRequest
   * rows for this leave type — not ledger data (submitting a request never
   * writes a ledger entry; see leave-request-actions.ts), so it neither
   * reduces `remaining` nor comes from the ledger. Surfaced here so every
   * consumer shows the same "reserved but not yet decided" figure instead
   * of only the post-decision balance. */
  pending: number
}

/**
 * Org-wide rollup for the Dashboard's Leave summary cards — scoped to
 * DAYS-unit leave types only. Mixing in HOURS-unit types (e.g. Hourly
 * Leave) would silently sum incompatible units into a meaningless number,
 * so they're excluded from this specific aggregate; they're still fully
 * visible per-employee via LeaveBalanceStatement, where each leave type
 * gets its own card and unit-mixing isn't a concern.
 */
export interface OrgLeaveDaysSummary {
  asOfDate: string
  totalOpeningBalance: number
  totalCarriedForward: number
  totalTaken: number
  totalRemaining: number
  /** SUM of every LeaveBalanceStatement.pending across the org, DAYS-unit
   * types only — same scoping reason as the totals above. */
  totalPending: number
}
