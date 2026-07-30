/**
 * The one interpreter for every conditionExpression stored anywhere in the
 * Approval Engine (workflow-definition matching, step inclusion). Reads a
 * small, closed rule-tree shape and evaluates it against whatever JSON
 * payload the calling module supplied — it has no idea what "amount" or
 * "numberOfDays" mean, no hardcoded field names, no business logic. This
 * is deliberately NOT a general expression language (no eval, no
 * user-supplied code) — just data in, boolean out.
 *
 * Shape (also what a future condition-builder UI would construct):
 *   { field: "amount", op: "gt", value: 5000 }
 *   { and: [ { field: "amount", op: "gt", value: 5000 }, { field: "currency", op: "eq", value: "AZN" } ] }
 *   { or: [ ... ] }
 */

export type ConditionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "notIn" | "contains"

export interface ConditionLeaf {
  field: string
  op: ConditionOperator
  value: unknown
}

export interface ConditionAndGroup {
  and: ConditionExpression[]
}

export interface ConditionOrGroup {
  or: ConditionExpression[]
}

export type ConditionExpression = ConditionLeaf | ConditionAndGroup | ConditionOrGroup

function isAndGroup(expr: ConditionExpression): expr is ConditionAndGroup {
  return typeof expr === "object" && expr !== null && "and" in expr
}

function isOrGroup(expr: ConditionExpression): expr is ConditionOrGroup {
  return typeof expr === "object" && expr !== null && "or" in expr
}

/** Dot-path lookup into an arbitrary JSON payload — "amount" or
 * "employee.departmentCode". Missing intermediate keys resolve to
 * undefined rather than throwing, so a condition referencing a field the
 * submitter didn't provide simply evaluates that leaf to false. */
function getFieldValue(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value === null || typeof value !== "object") return undefined
    return (value as Record<string, unknown>)[key]
  }, payload)
}

function evaluateLeaf(leaf: ConditionLeaf, payload: unknown): boolean {
  const actual = getFieldValue(payload, leaf.field)

  switch (leaf.op) {
    case "eq":
      return actual === leaf.value
    case "neq":
      return actual !== leaf.value
    case "gt":
      return typeof actual === "number" && typeof leaf.value === "number" && actual > leaf.value
    case "gte":
      return typeof actual === "number" && typeof leaf.value === "number" && actual >= leaf.value
    case "lt":
      return typeof actual === "number" && typeof leaf.value === "number" && actual < leaf.value
    case "lte":
      return typeof actual === "number" && typeof leaf.value === "number" && actual <= leaf.value
    case "in":
      return Array.isArray(leaf.value) && leaf.value.includes(actual)
    case "notIn":
      return Array.isArray(leaf.value) && !leaf.value.includes(actual)
    case "contains":
      if (Array.isArray(actual)) return actual.includes(leaf.value)
      if (typeof actual === "string" && typeof leaf.value === "string") return actual.includes(leaf.value)
      return false
    default:
      return false
  }
}

/** Null/undefined expression means "no condition" — always matches, the
 * same convention every conditionExpression column in this schema uses
 * (see ApprovalWorkflowDefinition/ApprovalStepDefinition model comments). */
export function evaluateCondition(expression: unknown, payload: unknown): boolean {
  if (expression === null || expression === undefined) return true
  const expr = expression as ConditionExpression

  if (isAndGroup(expr)) return expr.and.every((child) => evaluateCondition(child, payload))
  if (isOrGroup(expr)) return expr.or.some((child) => evaluateCondition(child, payload))
  return evaluateLeaf(expr as ConditionLeaf, payload)
}
