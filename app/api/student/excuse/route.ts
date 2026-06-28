import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { addAttendanceExcuse, getAttendanceExcuses } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const all = await getAttendanceExcuses();
  return NextResponse.json({ excuses: all.filter(e => e.registrationId === session.id) });
}

export async function POST(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { date, reason } = await req.json();
  if (!date || !String(reason ?? '').trim()) {
    return NextResponse.json({ error: 'التاريخ وسبب العذر مطلوبان' }, { status: 400 });
  }
  const excuse = await addAttendanceExcuse({
    registrationId: session.id,
    studentName: session.name,
    date,
    reason: String(reason).trim(),
  });
  return NextResponse.json({ ok: true, excuse });
}
