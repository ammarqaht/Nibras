import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAttendance, logAttendance, deleteAttendance, getStudents } from '@/lib/services';

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

    // Resolve membershipNo if provided instead of registrationId
    if (!registrationId && membershipNo) {
      const students = await getStudents();
      const mNo = parseInt(membershipNo, 10);
      const student = students.find(s => s.membershipNo === mNo);
      if (!student) {
        return NextResponse.json({ error: 'لم يتم العثور على طالب برقم العضوية هذا' }, { status: 404 });
      }
      registrationId = student.id;
    }

    const id = parseInt(registrationId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'معرّف الطالب غير صحيح' }, { status: 400 });
    }

    const record = await logAttendance(id, date, status, session.name);
    return NextResponse.json({ success: true, attendance: record });
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
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('attendance DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف السجل' }, { status: 500 });
  }
}
