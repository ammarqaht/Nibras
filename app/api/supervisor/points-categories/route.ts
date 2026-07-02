import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, saveSetting } from '@/lib/services';

export const dynamic = 'force-dynamic';

const DEFAULT_STUDENT_CATEGORIES = [
  { key: 'participation', label: 'مشاركة' },
  { key: 'behavior',     label: 'سلوك'   },
  { key: 'store',        label: 'متجر'   },
  { key: 'other',        label: 'أخرى'   },
];

const DEFAULT_GROUP_CATEGORIES = [
  { key: 'competition', label: 'مسابقة'  },
  { key: 'sports',      label: 'رياضي'   },
  { key: 'social',      label: 'اجتماعي' },
  { key: 'scientific',  label: 'علمي'    },
];

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const rawStudent = await getSetting('points_student_categories');
  const rawGroup = await getSetting('points_group_categories');

  let studentCategories = DEFAULT_STUDENT_CATEGORIES;
  let groupCategories = DEFAULT_GROUP_CATEGORIES;

  try {
    if (rawStudent) {
      const arr = JSON.parse(rawStudent);
      if (Array.isArray(arr) && arr.length) studentCategories = arr;
    }
  } catch (e) {}

  try {
    if (rawGroup) {
      const arr = JSON.parse(rawGroup);
      if (Array.isArray(arr) && arr.length) groupCategories = arr;
    }
  } catch (e) {}

  return NextResponse.json({ studentCategories, groupCategories });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const roles = (session.role || '').split(',').map((r: string) => r.trim());
  if (!roles.includes('admin')) {
    return NextResponse.json({ error: 'غير مصرح لك بهذا الإجراء (مطلوب مدير)' }, { status: 403 });
  }

  const { studentCategories, groupCategories } = await req.json();

  if (studentCategories && Array.isArray(studentCategories)) {
    const cleanStudent = studentCategories.map((c: any) => ({
      key: String(c.key).trim(),
      label: String(c.label).trim(),
    })).filter(c => c.key && c.label);
    await saveSetting('points_student_categories', JSON.stringify(cleanStudent));
  }

  if (groupCategories && Array.isArray(groupCategories)) {
    const cleanGroup = groupCategories.map((c: any) => ({
      key: String(c.key).trim(),
      label: String(c.label).trim(),
    })).filter(c => c.key && c.label);
    await saveSetting('points_group_categories', JSON.stringify(cleanGroup));
  }

  return NextResponse.json({ success: true });
}
