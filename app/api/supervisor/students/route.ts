import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStudents, updateStudent, getSupervisorByEmail } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    // Load latest supervisor details to check role and groupIds
    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const stage = searchParams.get('stage') || '';
    const neighborhood = searchParams.get('neighborhood') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';
    const registrationStatus = searchParams.get('registrationStatus') || '';
    const groupIdStr = searchParams.get('groupId') || '';

    let students = await getStudents();

    // Role-based scoping: supervisor only sees their group's students
    if (supervisor.role !== 'admin') {
      const allowedGroupIds = supervisor.groupIds
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));

      students = students.filter(s => s.groupId !== null && allowedGroupIds.includes(s.groupId));
    }

    // Apply search query
    if (search) {
      students = students.filter(s => 
        s.studentName.toLowerCase().includes(search) ||
        s.nationalId.includes(search) ||
        s.guardianPhone.includes(search) ||
        (s.studentPhone && s.studentPhone.includes(search)) ||
        s.membershipNo.toString().includes(search)
      );
    }

    // Apply filters
    if (stage) {
      students = students.filter(s => s.stage === stage);
    }
    if (neighborhood) {
      students = students.filter(s => s.neighborhood === neighborhood);
    }
    if (paymentStatus) {
      students = students.filter(s => s.paymentStatus === paymentStatus);
    }
    if (registrationStatus) {
      students = students.filter(s => s.registrationStatus === registrationStatus);
    }
    if (groupIdStr) {
      const gId = parseInt(groupIdStr, 10);
      students = students.filter(s => s.groupId === gId);
    }

    return NextResponse.json({ students });
  } catch (error) {
    console.error('students GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل البيانات' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    const body = await req.json();
    const id = parseInt(body.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'معرّف الطالب غير صحيح' }, { status: 400 });
    }

    // Check permissions
    if (supervisor.role !== 'admin') {
      // If supervisor, check if they are allowed to edit this student (student must be in their group)
      const allowedGroupIds = supervisor.groupIds
        .split(',')
        .map(gId => parseInt(gId.trim(), 10))
        .filter(gId => !isNaN(gId));

      const students = await getStudents();
      const student = students.find(s => s.id === id);
      if (!student || student.groupId === null || !allowedGroupIds.includes(student.groupId)) {
        return NextResponse.json({ error: 'غير مصرح لك بتعديل بيانات هذا الطالب' }, { status: 403 });
      }
    }

    const updated = await updateStudent(id, {
      studentName: body.studentName,
      nationalId: body.nationalId,
      guardianPhone: body.guardianPhone,
      studentPhone: body.studentPhone,
      stage: body.stage,
      grade: body.grade,
      neighborhood: body.neighborhood,
      locationLat: body.locationLat,
      locationLng: body.locationLng,
      hasCondition: body.hasCondition,
      conditionNote: body.conditionNote,
      paymentStatus: body.paymentStatus,
      groupId: body.groupId !== undefined ? (body.groupId === null ? null : parseInt(body.groupId, 10)) : undefined,
      registrationStatus: body.registrationStatus
    });

    return NextResponse.json({ success: true, student: updated });
  } catch (error) {
    console.error('students PUT error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل البيانات' }, { status: 500 });
  }
}
