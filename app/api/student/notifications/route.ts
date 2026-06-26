import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getNotifications, markNotificationsRead } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notifications = await getNotifications('student', session.id);
  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (body.action === 'mark_read') {
    await markNotificationsRead('student', session.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
