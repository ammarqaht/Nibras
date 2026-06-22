import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, saveSetting, getSupervisorByEmail } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
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

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    const roles = supervisor.role.split(',').map(r => r.trim());
    if (!roles.includes('admin') && !roles.includes('secretary')) {
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
