import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { getPoints, addPointsRecord, deletePointRecord, deletePointBatch, getSupervisorByEmail, GROUP_POINTS_ROLES } from '@/lib/services';

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
    const { registrationId, registrationIds, groupId, delta, reason, category } = body;



    const dVal = parseInt(delta, 10);
    if (isNaN(dVal) || !reason || !category) {
      return NextResponse.json({ error: 'البيانات غير كاملة أو غير صحيحة' }, { status: 400 });
    }

    // Deductions always go to balance (deduction type), never to individual/collective
    const isDeduction = dVal < 0;

    // Helper: compute current balance for a student from their points
    function calcBalance(pts: { delta: number; pointType?: string; reason?: string }[]): number {
      let individual = 0, collective = 0, deduction = 0;
      for (const p of pts) {
        const t = p.pointType ?? (
          (p.reason ?? '').endsWith('(رصد جماعي للأسرة)') ? 'collective'
            : p.delta < 0 ? 'deduction' : 'individual'
        );
        if (t === 'individual') individual += p.delta;
        else if (t === 'collective') collective += p.delta;
        else deduction += p.delta;
      }
      return Math.max(0, individual + collective + deduction);
    }

    // Multi-student individual points
    if (registrationIds && Array.isArray(registrationIds) && registrationIds.length > 0) {
      if (isDeduction) {
        const allPts = await getPoints();
        const insufficient: number[] = [];
        for (const rId of registrationIds) {
          const id = parseInt(String(rId), 10);
          if (isNaN(id)) continue;
          const balance = calcBalance(allPts.filter(p => p.registrationId === id));
          if (balance + dVal < 0) insufficient.push(id);
        }
        if (insufficient.length > 0) {
          return NextResponse.json({ error: 'رصيد بعض الطلاب غير كافٍ لإتمام الخصم' }, { status: 400 });
        }
      }
      const records = [];
      for (const rId of registrationIds) {
        const id = parseInt(String(rId), 10);
        if (isNaN(id)) continue;
        const pointType = isDeduction ? 'deduction' : 'individual';
        const rec = await addPointsRecord({
          registrationId: id,
          delta: dVal,
          reason,
          category,
          pointType,
          recordedBy: session.name,
        });
        records.push(rec);
      }
      return NextResponse.json({ success: true, pointRecords: records, bulk: true, count: records.length });
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

      if (isDeduction) {
        const allPts = await getPoints();
        const insufficient = studentsInGroup.filter(s => {
          const balance = calcBalance(allPts.filter(p => p.registrationId === s.id));
          return balance + dVal < 0;
        });
        if (insufficient.length > 0) {
          return NextResponse.json({
            error: `رصيد ${insufficient.length} طالب/طلاب في الأسرة غير كافٍ لإتمام الخصم`
          }, { status: 400 });
        }
      }

      // One batchId ties together all per-student records from this single
      // group registration so the log can show them as one row (by group name).
      const batchId = randomUUID();
      const records = [];
      for (const s of studentsInGroup) {
        const rec = await addPointsRecord({
          registrationId: s.id,
          delta: dVal,
          reason: `${reason} (رصد جماعي للأسرة)`,
          category,
          pointType: isDeduction ? 'deduction' : 'collective',
          batchId,
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

      if (isDeduction) {
        const allPts = await getPoints();
        const balance = calcBalance(allPts.filter(p => p.registrationId === rId));
        if (balance + dVal < 0) {
          return NextResponse.json({ error: 'رصيد الطالب غير كافٍ لإتمام الخصم' }, { status: 400 });
        }
      }

      const pointType = isDeduction ? 'deduction' : 'individual';

      const record = await addPointsRecord({
        registrationId: rId,
        delta: dVal,
        reason,
        category,
        pointType,
        recordedBy: session.name
      });

      return NextResponse.json({ success: true, pointRecord: record, bulk: false });
    }
  } catch (error) {
    console.error('points POST error', error);
    return NextResponse.json({ error: 'حدث خطأ في تسجيل النقاط' }, { status: 500 });
  }
}

// Cancel an erroneous entry by permanently removing the point record.
// Unlike a deduction (which only lowers the balance), deleting the record
// removes the points from both the total (الاجمالي) and the balance (الرصيد).
export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    // Cancelling/deleting point records is restricted to the admin only.
    const roles = supervisor.role.split(',').map(r => r.trim());
    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'هذه الصلاحية متاحة للمدير فقط' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');

    // Delete a whole group registration (all per-student records) by batchId.
    if (batchId) {
      const count = await deletePointBatch(batchId);
      if (count === 0) {
        return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
      }
      return NextResponse.json({ success: true, deletedCount: count });
    }

    const id = parseInt(searchParams.get('id') ?? '', 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'رقم السجل غير صحيح' }, { status: 400 });
    }

    const deleted = await deletePointRecord(id);
    if (!deleted) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('points DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف السجل' }, { status: 500 });
  }
}
