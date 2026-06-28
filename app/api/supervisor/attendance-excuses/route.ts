import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAttendanceExcuses, resolveAttendanceExcuse } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const excuses = await getAttendanceExcuses();
  // Newest first
  excuses.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return NextResponse.json({ excuses });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const roles = (session.role || '').split(',').map((r: string) => r.trim());
  if (!roles.some((r: string) => ['admin', 'attendance_supervisor'].includes(r))) {
    return NextResponse.json({ error: 'غير مصرح لك بهذا الإجراء' }, { status: 403 });
  }
  const { id, accept } = await req.json();
  if (!id) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 400 });
  const excuse = await resolveAttendanceExcuse(String(id), !!accept, session.name);
  if (!excuse) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  return NextResponse.json({ ok: true, excuse });
}
