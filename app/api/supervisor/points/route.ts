import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPoints, addPointsRecord, getSupervisorByEmail } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentIdStr = searchParams.get('studentId') || '';

    let points = await getPoints();

    const roles = supervisor.role.split(',').map(r => r.trim());
    const isGlobal = roles.some(r =>
      ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
    );



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

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    const roles = supervisor.role.split(',').map(r => r.trim());
    const isGlobal = roles.some(r =>
      ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
    );

    const body = await req.json();
    const { registrationId, groupId, delta, reason, category } = body;

    if (groupId) {
      const groupAllowedRoles = ['admin', 'cultural_supervisor', 'sports_supervisor', 'general_supervisor', 'social_supervisor'];
      const canAddGroupPoints = roles.some(r => groupAllowedRoles.includes(r));
      if (!canAddGroupPoints) {
        return NextResponse.json({ error: 'غير مصرح لك برصد النقاط للمجموعات' }, { status: 403 });
      }
    }

    const dVal = parseInt(delta, 10);
    if (isNaN(dVal) || !reason || !category) {
      return NextResponse.json({ error: 'البيانات غير كاملة أو غير صحيحة' }, { status: 400 });
    }

    if (groupId) {
      const gId = parseInt(groupId, 10);
      if (isNaN(gId)) {
        return NextResponse.json({ error: 'رقم المجموعة غير صحيح' }, { status: 400 });
      }

      const { getStudents } = await import('@/lib/services');
      const allStudents = await getStudents();
      const studentsInGroup = allStudents.filter(s => s.groupId === gId);

      if (studentsInGroup.length === 0) {
        return NextResponse.json({ error: 'لا يوجد طلاب مسجلين في هذه المجموعة / الأسرة' }, { status: 400 });
      }

      const records = [];
      for (const s of studentsInGroup) {
        const rec = await addPointsRecord({
          registrationId: s.id,
          delta: dVal,
          reason: `${reason} (رصد جماعي للأسرة)`,
          category,
          recordedBy: session.name
        });
        records.push(rec);
      }

      return NextResponse.json({ success: true, pointRecords: records, bulk: true });
    } else {
      const rId = parseInt(registrationId, 10);
      if (isNaN(rId)) {
        return NextResponse.json({ error: 'الطالب المحدد غير صحيح' }, { status: 400 });
      }

      const record = await addPointsRecord({
        registrationId: rId,
        delta: dVal,
        reason,
        category,
        recordedBy: session.name
      });

      return NextResponse.json({ success: true, pointRecord: record, bulk: false });
    }
  } catch (error) {
    console.error('points POST error', error);
    return NextResponse.json({ error: 'حدث خطأ في تسجيل النقاط' }, { status: 500 });
  }
}
