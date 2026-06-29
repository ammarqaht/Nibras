import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resetAllPoints } from '@/lib/services';

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const roles = session.role.split(',').map(r => r.trim());
    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'غير مصرح لك بتصفير النقاط' }, { status: 403 });
    }

    const body = await req.json();
    const { password } = body;

    if (password !== '123asd') {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 400 });
    }

    await resetAllPoints();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('reset-points POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تصفير النقاط' }, { status: 500 });
  }
}
