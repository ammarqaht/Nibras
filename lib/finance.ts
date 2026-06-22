// ============================================================
// Departments, expense categories and finance constants.
// Edit the Arabic labels here in one place.
// ============================================================

// Department keys mirror the supervisor "role" keys used on the supervisors page,
// so a supervisor files an invoice under one of the roles they already hold.
export const DEPARTMENTS = [
  { key: 'cultural_head', label: 'الثقافية' },
  { key: 'sports_head', label: 'الرياضية' },
  { key: 'media_head', label: 'الإعلامية' },
  { key: 'attendance_supervisor', label: 'التحضير' },
  { key: 'group_supervisor', label: 'الأسر' }
] as const;

export const departmentLabel = (key: string) =>
  DEPARTMENTS.find((d) => d.key === key)?.label ?? key;

// The departments a supervisor can file invoices under = the department-roles
// in their (comma-separated) role string. admin/finance file under any.
export function supervisorDepartments(role: string): string[] {
  const roles = (role || '').split(',').map((r) => r.trim());
  const isGlobal = roles.some((r) => ['admin', 'secretary', 'finance_head', 'finance'].includes(r));
  if (isGlobal) return [];
  const keys = DEPARTMENTS.map((d) => d.key as string);
  return parseDepartments(role).filter((r) => keys.includes(r));
}

export const CATEGORIES = [
  { key: 'food', label: 'طعام وضيافة' },
  { key: 'supplies', label: 'أدوات ومستلزمات' },
  { key: 'prizes', label: 'جوائز وتحفيز' },
  { key: 'transport', label: 'مواصلات' },
  { key: 'printing', label: 'طباعة' },
  { key: 'other', label: 'أخرى' }
] as const;

export const categoryLabel = (key: string) =>
  CATEGORIES.find((c) => c.key === key)?.label ?? key;

// Invoice lifecycle
export const INVOICE_STATUS = {
  pending: 'قيد المراجعة',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  on_hold: 'معلّقة'
} as const;

export const statusLabel = (s: string) =>
  (INVOICE_STATUS as Record<string, string>)[s] ?? s;

// invoice numbers start at this base + sequence
export const INVOICE_BASE = 5000;

export function parseDepartments(csv: string): string[] {
  return (csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
