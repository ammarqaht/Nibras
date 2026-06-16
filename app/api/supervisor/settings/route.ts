import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, saveSetting } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('settings GET error', error);
    return NextResponse.json({ error: 'حدث خطأ في تحميل الإعدادات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل الإعدادات' }, { status: 403 });
    }

    const body = await req.json();
    const { key, value } = body;
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'المفتاح أو القيمة غير صالحة' }, { status: 400 });
    }

    await saveSetting(key, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('settings POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ الإعدادات' }, { status: 500 });
  }
}
