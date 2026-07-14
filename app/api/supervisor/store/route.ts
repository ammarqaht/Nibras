import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getAllSupervisors,
  getSettings,
  getPoints,
  getStudents,
  addPointsRecord,
  deletePointRecord,
  calcPointSummary,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/lib/services';

// The store sells against the student's spendable balance. Every purchase is a
// balance-only deduction (pointType 'deduction', category 'store') so it lowers
// the الرصيد without touching the الفردية/الجماعية that drive the leaderboard.
const STORE_CATEGORY = 'store';
const REASON_PREFIX = 'شراء من المتجر: ';
const LOG_LIMIT = 200;

// Same emails auth/me force-promotes to admin — mirror it so the store's
// access check agrees with the rest of the app.
const ADMIN_EMAILS = ['admin', 'admin@nibras.com', 'mohammed.qahtani', 'mohammed.yabis', '2000', '2001', '2005'];

// Rebuilds the supervisor's effective page permissions exactly like
// /api/supervisor/auth/me, then answers whether they may operate the store.
async function canAccessStore(email: string): Promise<{ ok: boolean; name: string } | null> {
  const supervisors = await getAllSupervisors();
  const current = supervisors.find(s => s.email.toLowerCase().trim() === email.toLowerCase().trim());
  if (!current) return null;

  let role = current.role;
  if (ADMIN_EMAILS.includes(current.email.toLowerCase().trim())) role = 'admin';

  const roles = role.split(',').map(r => r.trim()).filter(Boolean);
  if (roles.includes('admin')) return { ok: true, name: current.name };

  const settings = await getSettings();
  let map: Record<string, string[]> = DEFAULT_ROLE_PERMISSIONS;
  try {
    if (settings.role_permissions) map = JSON.parse(settings.role_permissions);
  } catch {}

  const perms = new Set<string>();
  for (const r of roles) (map[r] || []).forEach(p => perms.add(p));

  if (current.customPermissions) {
    current.customPermissions.split(',').map(p => p.trim()).filter(Boolean).forEach(p => {
      if (p.startsWith('-')) perms.delete(p.substring(1));
      else perms.add(p);
    });
  }

  return { ok: perms.has(STORE_CATEGORY), name: current.name };
}

function productFromReason(reason: string): string {
  return reason.startsWith(REASON_PREFIX) ? reason.slice(REASON_PREFIX.length) : reason;
}

// Builds the store-wide withdrawal log: every store deduction across all
// students, newest first, annotated with the student and the supervisor who
// performed it.
async function buildGlobalLog() {
  const [all, students] = await Promise.all([getPoints(), getStudents()]);
  const byId = new Map(students.map(s => [s.id, s]));
  return all
    .filter(p => p.category === STORE_CATEGORY && p.delta < 0)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, LOG_LIMIT)
    .map(p => {
      const st = byId.get(p.registrationId);
      return {
        id: p.id,
        registrationId: p.registrationId,
        studentName: st?.studentName ?? 'طالب غير معروف',
        membershipNo: st?.membershipNo ?? null,
        product: productFromReason(p.reason),
        amount: Math.abs(p.delta),
        recordedBy: p.recordedBy ?? '',
        createdAt: p.createdAt,
      };
    });
}

async function summaryFor(registrationId: number) {
  const all = await getPoints();
  return calcPointSummary(all.filter(p => p.registrationId === registrationId));
}

// GET ?studentId=123 -> that student's point summary + the global store log.
// GET (no param)      -> just the global store log.
export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

    const access = await canAccessStore(session.email);
    if (!access) return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    if (!access.ok) return NextResponse.json({ error: 'لا تملك صلاحية الوصول إلى المتجر' }, { status: 403 });

    const studentIdRaw = new URL(req.url).searchParams.get('studentId');
    const globalLog = await buildGlobalLog();

    if (studentIdRaw) {
      const studentId = parseInt(studentIdRaw, 10);
      if (isNaN(studentId)) return NextResponse.json({ error: 'رقم الطالب غير صحيح' }, { status: 400 });
      return NextResponse.json({ summary: await summaryFor(studentId), globalLog });
    }

    return NextResponse.json({ globalLog });
  } catch (error) {
    console.error('store GET error', error);
    return NextResponse.json({ error: 'حدث خطأ في جلب بيانات المتجر' }, { status: 500 });
  }
}

// POST { registrationId, amount, product } -> records a balance withdrawal.
export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

    const access = await canAccessStore(session.email);
    if (!access) return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    if (!access.ok) return NextResponse.json({ error: 'لا تملك صلاحية الوصول إلى المتجر' }, { status: 403 });

    const body = await req.json();
    const registrationId = parseInt(String(body.registrationId), 10);
    const amount = parseInt(String(body.amount), 10);
    const product = String(body.product ?? '').trim();

    if (isNaN(registrationId)) return NextResponse.json({ error: 'الطالب المحدد غير صحيح' }, { status: 400 });
    if (isNaN(amount) || amount <= 0) return NextResponse.json({ error: 'أدخل مبلغ سحب صحيحاً' }, { status: 400 });
    if (!product) return NextResponse.json({ error: 'اكتب اسم المنتج' }, { status: 400 });

    const summary = await summaryFor(registrationId);
    if (amount > summary.balance) {
      return NextResponse.json(
        { error: 'الطالب لا يملك رصيداً كافياً', balance: summary.balance },
        { status: 400 }
      );
    }

    await addPointsRecord({
      registrationId,
      delta: -amount,
      reason: `${REASON_PREFIX}${product}`,
      category: STORE_CATEGORY,
      pointType: 'deduction',
      recordedBy: session.name,
    });

    // Return the recomputed summary + log so the UI refreshes in one round-trip.
    return NextResponse.json({
      success: true,
      summary: await summaryFor(registrationId),
      globalLog: await buildGlobalLog(),
    });
  } catch (error) {
    console.error('store POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل عملية السحب' }, { status: 500 });
  }
}

// DELETE ?id=123 -> cancels a store purchase, restoring the withdrawn balance.
// Guarded so only a store record can be removed through this endpoint.
export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

    const access = await canAccessStore(session.email);
    if (!access) return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    if (!access.ok) return NextResponse.json({ error: 'لا تملك صلاحية الوصول إلى المتجر' }, { status: 403 });

    const id = parseInt(new URL(req.url).searchParams.get('id') ?? '', 10);
    if (isNaN(id)) return NextResponse.json({ error: 'رقم العملية غير صحيح' }, { status: 400 });

    const all = await getPoints();
    const record = all.find(p => p.id === id);
    if (!record) return NextResponse.json({ error: 'العملية غير موجودة' }, { status: 404 });
    if (record.category !== STORE_CATEGORY || record.delta >= 0) {
      return NextResponse.json({ error: 'لا يمكن إلغاء هذه العملية من المتجر' }, { status: 400 });
    }

    const deleted = await deletePointRecord(id);
    if (!deleted) return NextResponse.json({ error: 'العملية غير موجودة' }, { status: 404 });

    return NextResponse.json({
      success: true,
      registrationId: record.registrationId,
      summary: await summaryFor(record.registrationId),
      globalLog: await buildGlobalLog(),
      restored: Math.abs(record.delta),
    });
  } catch (error) {
    console.error('store DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إلغاء العملية' }, { status: 500 });
  }
}
