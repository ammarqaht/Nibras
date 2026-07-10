import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, saveSetting } from '@/lib/services';

export const dynamic = 'force-dynamic';

// `fromIndividual` applies only to student (individual) deduction categories:
// when true, a deduction using this category is subtracted from the student's
// individual score AND their balance; when false/absent, from the balance only.
type Cat = { key: string; label: string; fromIndividual?: boolean };

// Defaults are split by operation (add / deduct) and by scope (individual / group).
const DEFAULT_STUDENT_ADD: Cat[] = [
  { key: 'participation', label: 'مشاركة' },
  { key: 'behavior',      label: 'سلوك'   },
  { key: 'excellence',    label: 'تميّز'  },
  { key: 'other',         label: 'أخرى'   },
];
const DEFAULT_STUDENT_DEDUCT: Cat[] = [
  { key: 'store',      label: 'متجر'   },
  { key: 'violation',  label: 'مخالفة' },
  { key: 'other',      label: 'أخرى'   },
];
const DEFAULT_GROUP_ADD: Cat[] = [
  { key: 'competition', label: 'مسابقة'  },
  { key: 'sports',      label: 'رياضي'   },
  { key: 'social',      label: 'اجتماعي' },
  { key: 'scientific',  label: 'علمي'    },
];
const DEFAULT_GROUP_DEDUCT: Cat[] = [
  { key: 'violation', label: 'مخالفة' },
  { key: 'other',     label: 'أخرى'   },
];

// Setting keys. The *_add keys fall back to the legacy keys so previously saved
// addition categories are preserved after the add/deduct split was introduced.
const KEY_STUDENT_ADD = 'points_student_add_categories';
const KEY_STUDENT_DEDUCT = 'points_student_deduct_categories';
const KEY_GROUP_ADD = 'points_group_add_categories';
const KEY_GROUP_DEDUCT = 'points_group_deduct_categories';
const LEGACY_STUDENT = 'points_student_categories';
const LEGACY_GROUP = 'points_group_categories';

function parseCats(raw: string | null): Cat[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) {
      return arr
        .map((c: any) => ({
          key: String(c.key ?? '').trim(),
          label: String(c.label ?? '').trim(),
          ...(c.fromIndividual ? { fromIndividual: true } : {}),
        }))
        .filter(c => c.key && c.label);
    }
  } catch { /* ignore */ }
  return null;
}

async function resolve(primaryKey: string, legacyKey: string | null, fallback: Cat[]): Promise<Cat[]> {
  const primary = parseCats(await getSetting(primaryKey));
  if (primary) return primary;
  if (legacyKey) {
    const legacy = parseCats(await getSetting(legacyKey));
    if (legacy) return legacy;
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const [studentAddCategories, studentDeductCategories, groupAddCategories, groupDeductCategories] =
    await Promise.all([
      resolve(KEY_STUDENT_ADD, LEGACY_STUDENT, DEFAULT_STUDENT_ADD),
      resolve(KEY_STUDENT_DEDUCT, null, DEFAULT_STUDENT_DEDUCT),
      resolve(KEY_GROUP_ADD, LEGACY_GROUP, DEFAULT_GROUP_ADD),
      resolve(KEY_GROUP_DEDUCT, null, DEFAULT_GROUP_DEDUCT),
    ]);

  return NextResponse.json({
    studentAddCategories,
    studentDeductCategories,
    groupAddCategories,
    groupDeductCategories,
    // Legacy fields kept for backward compatibility (map to the addition lists).
    studentCategories: studentAddCategories,
    groupCategories: groupAddCategories,
  });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const roles = (session.role || '').split(',').map((r: string) => r.trim());
  if (!roles.includes('admin')) {
    return NextResponse.json({ error: 'غير مصرح لك بهذا الإجراء (مطلوب مدير)' }, { status: 403 });
  }

  const body = await req.json();

  const clean = (arr: any): Cat[] =>
    Array.isArray(arr)
      ? arr
          .map((c: any) => ({
            key: String(c.key ?? '').trim(),
            label: String(c.label ?? '').trim(),
            ...(c.fromIndividual ? { fromIndividual: true } : {}),
          }))
          .filter(c => c.key && c.label)
      : [];

  const saves: Promise<void>[] = [];
  if (body.studentAddCategories !== undefined)
    saves.push(saveSetting(KEY_STUDENT_ADD, JSON.stringify(clean(body.studentAddCategories))));
  if (body.studentDeductCategories !== undefined)
    saves.push(saveSetting(KEY_STUDENT_DEDUCT, JSON.stringify(clean(body.studentDeductCategories))));
  if (body.groupAddCategories !== undefined)
    saves.push(saveSetting(KEY_GROUP_ADD, JSON.stringify(clean(body.groupAddCategories))));
  if (body.groupDeductCategories !== undefined)
    saves.push(saveSetting(KEY_GROUP_DEDUCT, JSON.stringify(clean(body.groupDeductCategories))));

  // Backward compatibility: accept the old field names as the addition lists.
  if (body.studentCategories !== undefined && body.studentAddCategories === undefined)
    saves.push(saveSetting(KEY_STUDENT_ADD, JSON.stringify(clean(body.studentCategories))));
  if (body.groupCategories !== undefined && body.groupAddCategories === undefined)
    saves.push(saveSetting(KEY_GROUP_ADD, JSON.stringify(clean(body.groupCategories))));

  await Promise.all(saves);
  return NextResponse.json({ success: true });
}
