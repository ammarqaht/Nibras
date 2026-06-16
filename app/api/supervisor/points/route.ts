import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPoints, addPointsRecord } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentIdStr = searchParams.get('studentId') || '';

    let points = await getPoints();

    if (studentIdStr) {
      const sId = parseInt(studentIdStr, 10);
      points = points.filter(p => p.registrationId === sId);
    }

    return NextResponse.json({ points });
  } catch (error) {
    console.error('points GET error', error);
    return NextResponse.json({ error: 'حدث خطأ في جلب سجل النقاط' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    const { registrationId, delta, reason, category } = body;

    const rId = parseInt(registrationId, 10);
    const dVal = parseInt(delta, 10);

    if (isNaN(rId) || isNaN(dVal) || !reason || !category) {
      return NextResponse.json({ error: 'البيانات غير كاملة أو غير صحيحة' }, { status: 400 });
    }

    const record = await addPointsRecord({
      registrationId: rId,
      delta: dVal,
      reason,
      category,
      recordedBy: session.name
    });

    return NextResponse.json({ success: true, pointRecord: record });
  } catch (error) {
    console.error('points POST error', error);
    return NextResponse.json({ error: 'حدث خطأ في تسجيل النقاط' }, { status: 500 });
  }
}
