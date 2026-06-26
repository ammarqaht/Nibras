import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getNotifications, markNotificationsRead } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const list = await getNotifications('supervisor', Number(session.id));
    return NextResponse.json({ notifications: list });
  } catch (error) {
    console.error('notifications GET error', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const body = await req.json();
    if (body.action === 'mark_read') {
      await markNotificationsRead('supervisor', Number(session.id));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error) {
    console.error('notifications POST error', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
