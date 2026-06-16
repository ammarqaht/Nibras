import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAnnouncements, createAnnouncement } from '@/lib/services';

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
