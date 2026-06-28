import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, saveSetting } from '@/lib/services';

const DEFAULTS = ['مستلزمات', 'ضيافة', 'مواصلات', 'طباعة', 'جوائز', 'أخرى'];

async function readCats(): Promise<string[]> {
  const raw = await getSetting('invoice_categories');
  try {
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.length ? arr : DEFAULTS;
  } catch { return DEFAULTS; }
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  return NextResponse.json({ categories: await readCats() });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const roles = (session.role || '').split(',').map((r: string) => r.trim());
  if (!roles.some((r: string) => ['admin', 'finance', 'finance_supervisor'].includes(r))) {
    return NextResponse.json({ error: 'غير مصرح لك بهذا الإجراء' }, { status: 403 });
  }
  const { categories } = await req.json();
  if (!Array.isArray(categories)) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  const clean = Array.from(new Set(categories.map((c: unknown) => String(c).trim()).filter(Boolean)));
  await saveSetting('invoice_categories', JSON.stringify(clean));
  return NextResponse.json({ categories: clean });
}
