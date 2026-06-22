import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAnnouncements, createAnnouncement, getSupervisorByEmail } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const announcements = await getAnnouncements();
    return NextResponse.json({ announcements });
  } catch (error) {
    console.error('announcements GET error', error);
    return NextResponse.json({ error: 'حدث خطأ في تحميل الإعلانات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    const roles = supervisor.role.split(',').map(r => r.trim());
    const isAllowed = roles.some(r => ['admin', 'media_supervisor', 'general_supervisor'].includes(r));
    if (!isAllowed) {
      return NextResponse.json({ error: 'غير مصرح لك بنشر الإعلانات' }, { status: 403 });
    }

    const body = await req.json();
    const { title, body: contentText, audience } = body;
    if (!title || !contentText || !audience) {
      return NextResponse.json({ error: 'البيانات غير كاملة (العنوان والمحتوى والجمهور مطلوبان)' }, { status: 400 });
    }

    const announcement = await createAnnouncement(title, contentText, audience);
    return NextResponse.json({ success: true, announcement });
  } catch (error) {
    console.error('announcements POST error', error);
    return NextResponse.json({ error: 'حدث خطأ في نشر الإعلان' }, { status: 500 });
  }
}
