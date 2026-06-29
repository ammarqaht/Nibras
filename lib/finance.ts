// ============================================================
// Departments, expense categories and finance constants.
// Edit the Arabic labels here in one place.
// ============================================================

// Department keys mirror the supervisor "role" keys used on the supervisors page,
// so a supervisor files an invoice under one of the roles they already hold.
export const DEPARTMENTS = [
  { key: 'cultural_supervisor', label: 'الثقافية' },
  { key: 'social_supervisor', label: 'الاجتماعية' },
  { key: 'attendance_supervisor', label: 'التحضير' },
  { key: 'groups_supervisor', label: 'الأسر' },
  { key: 'general_supervisor', label: 'العام' },
  { key: 'media_officer', label: 'الإعلامية (مسؤول)' },
  { key: 'media_supervisor', label: 'الإعلامية (مشرف)' },
  { key: 'tasks_supervisor', label: 'المهام' }
] as const;

export const departmentLabel = (key: string) =>
  DEPARTMENTS.find((d) => d.key === key)?.label ?? key;

// The departments a supervisor can file invoices under = the department-roles
// in their (comma-separated) role string. admin/finance file under any.
export function supervisorDepartments(role: string): string[] {
  if (!role || role === 'admin' || role === 'finance') return [];
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
