import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getAttendance, logAttendance, deleteAttendance, getStudents,
  getSettings, deleteAttendancePointsByDate, addPointsRecord,
} from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || '';
    const groupIdStr = searchParams.get('groupId') || '';

    let records = await getAttendance();
    const students = await getStudents();

    if (date) {
      records = records.filter(r => r.date === date);
    }

    if (groupIdStr) {
      const gId = parseInt(groupIdStr, 10);
      const studentIdsInGroup = new Set(students.filter(s => s.groupId === gId).map(s => s.id));
      records = records.filter(r => studentIdsInGroup.has(r.registrationId));
    }

    return NextResponse.json({ attendance: records });
  } catch (error) {
    console.error('attendance GET error', error);
    return NextResponse.json({ error: 'حدث خطأ في جلب بيانات التحضير' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    let { registrationId, membershipNo, date, status } = body;

    if (!date || !status) {
      return NextResponse.json({ error: 'البيانات غير كاملة (التاريخ والحالة مطلوبان)' }, { status: 400 });
    }

    // ── Batch mode: registrationIds[] processed sequentially to avoid file race conditions ──
    if (Array.isArray(body.registrationIds) && body.registrationIds.length > 0) {
      const cfg = await getSettings();
      const onTimePoints  = Number(cfg.att_onTimePoints  ?? '2');
      const latePoints    = Number(cfg.att_latePoints    ?? '1');
      const excusedPoints = Number(cfg.att_excusedPoints ?? '0');

      let count = 0;
      for (const rawId of body.registrationIds) {
        const bid = parseInt(String(rawId), 10);
        if (isNaN(bid)) continue;
        await logAttendance(bid, date, status, session.name);
        await deleteAttendancePointsByDate(bid, date);
        // Attendance points recording disabled per user request
        /*
        const pts = status === 'present' ? onTimePoints
                  : status === 'late'    ? latePoints
                  : status === 'excused' ? excusedPoints
                  : 0;
        if (pts > 0) {
          const label = status === 'present' ? 'حضور بالوقت'
                      : status === 'late'    ? 'حضور متأخر'
                      : 'اعتذار';
          await addPointsRecord({
            registrationId: bid, delta: pts,
            reason: `${label} | ${date}`, category: 'attendance',
            pointType: 'individual', recordedBy: session.name,
          });
        }
        */
        count++;
      }
      return NextResponse.json({ success: true, count });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Resolve membershipNo → registrationId if needed
    let resolvedStudent: any = null;
    if (!registrationId && membershipNo) {
      const students = await getStudents();
      const mNo = parseInt(membershipNo, 10);
      resolvedStudent = students.find(s => s.membershipNo === mNo) ?? null;
      if (!resolvedStudent) {
        return NextResponse.json({ error: 'لم يتم العثور على طالب برقم العضوية هذا' }, { status: 404 });
      }
      registrationId = resolvedStudent.id;
    }

    const id = parseInt(registrationId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'معرّف الطالب غير صحيح' }, { status: 400 });
    }

    // Save attendance (upsert)
    const record = await logAttendance(id, date, status, session.name);

    // ── Point adjustment ──────────────────────────────────────────────────────
    const s = await getSettings();
    const onTimePoints  = Number(s.att_onTimePoints  ?? '2');
    const latePoints    = Number(s.att_latePoints    ?? '1');
    const excusedPoints = Number(s.att_excusedPoints ?? '0');

    await deleteAttendancePointsByDate(id, date);
    // Attendance points recording disabled per user request
    /*
    const pts = status === 'present' ? onTimePoints
              : status === 'late'    ? latePoints
              : status === 'excused' ? excusedPoints
              : 0;

    if (pts > 0) {
      const label = status === 'present' ? 'حضور بالوقت'
                  : status === 'late'    ? 'حضور متأخر'
                  : 'اعتذار';
      await addPointsRecord({
        registrationId: id,
        delta: pts,
        reason: `${label} | ${date}`,
        category: 'attendance',
        pointType: 'individual',
        recordedBy: session.name,
      });
    }
    */
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({ success: true, attendance: record, student: resolvedStudent });
  } catch (error) {
    console.error('attendance POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل التحضير' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const registrationId = parseInt(searchParams.get('registrationId') ?? '', 10);
    const date = searchParams.get('date') ?? '';

    if (isNaN(registrationId) || !date) {
      return NextResponse.json({ error: 'بيانات غير كاملة' }, { status: 400 });
    }

    await deleteAttendance(registrationId, date);
    // Also remove attendance points for that student+date
    await deleteAttendancePointsByDate(registrationId, date);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('attendance DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف السجل' }, { status: 500 });
  }
}
