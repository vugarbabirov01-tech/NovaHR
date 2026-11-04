import { leaveRequestStatusMessageKeys } from "@/lib/leave/leave-request-status-display"
import type { ReportFieldDefinition } from "@/lib/reports/field-registry"

/**
 * LEAVE_REQUESTS data source — one row per LeaveRequest (not per employee;
 * an employee with 3 requests correctly appears 3 times, that's the real
 * grain, not double-counting). employeeName/employeeDepartment/
 * employeeCompany are read-only context resolved via an employeeId lookup
 * map (see leave-report-data-source.ts), never a join that could fan out
 * rows.
 *
 * leaveTypeName deliberately has no enumValues/enumNamespace here — see
 * leave-report-data-source.ts's VISIBLE_LEAVE_TYPE_CODES allowlist. Any
 * leave type not on that allowlist (Sick/Maternity/Paternity today, and
 * any future type not explicitly added to the allowlist) never reaches
 * this data source's rows at all, so there is nothing for a filter value
 * list to even offer — the exclusion happens before this registry's
 * fields are ever evaluated, not as a filter a user could work around.
 */
export const LEAVE_REQUEST_FIELDS: ReportFieldDefinition[] = [
  { key: "leaveTypeName", category: "leave", type: "string", labelKey: "leaveTypeName", dataSource: "LEAVE_REQUESTS" },
  { key: "leaveStartDate", category: "leave", type: "date", labelKey: "leaveStartDate", dataSource: "LEAVE_REQUESTS" },
  { key: "leaveEndDate", category: "leave", type: "date", labelKey: "leaveEndDate", dataSource: "LEAVE_REQUESTS" },
  {
    key: "leaveRequestedUnits",
    category: "leave",
    type: "number",
    labelKey: "leaveRequestedUnits",
    dataSource: "LEAVE_REQUESTS",
  },
  {
    key: "leaveStatus",
    category: "leave",
    type: "enum",
    labelKey: "leaveStatus",
    dataSource: "LEAVE_REQUESTS",
    enumNamespace: "Employees.profile.leave.requestStatus",
    enumKeyMap: leaveRequestStatusMessageKeys,
    enumValues: ["DRAFT", "SUBMITTED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED", "WITHDRAWN"],
  },
  {
    key: "leaveEmployeeName",
    category: "leave",
    type: "string",
    labelKey: "leaveEmployeeName",
    dataSource: "LEAVE_REQUESTS",
  },
  {
    key: "leaveEmployeeDepartment",
    category: "leave",
    type: "string",
    labelKey: "leaveEmployeeDepartment",
    dataSource: "LEAVE_REQUESTS",
  },
  {
    key: "leaveEmployeeCompany",
    category: "leave",
    type: "string",
    labelKey: "leaveEmployeeCompany",
    dataSource: "LEAVE_REQUESTS",
  },
]
