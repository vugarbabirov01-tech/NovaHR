/**
 * Nova has no Tenant model or auth-level tenant boundary yet — Company
 * (prisma/schema.prisma) is master data *within* one deployment, not a SaaS
 * tenant. PayrollPeriod.tenantId exists purely so the schema doesn't need a
 * migration the day real multi-tenancy is built; until then every payroll
 * read/write goes through this one constant. Never derive a "real" tenant
 * id from Company/Branch — there isn't one yet.
 */
export const DEFAULT_TENANT_ID = "default"
