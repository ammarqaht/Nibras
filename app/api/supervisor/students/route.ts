import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStudents, updateStudent, getSupervisorByEmail, createStudentManually, deleteStudent } from '@/lib/services';

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

    // Role-based scoping: supervisor only sees their group's students if they are not in a global role.
    const roles = supervisor.role.split(',').map(r => r.trim());
    const isGlobal = roles.some(r =>
      ['admin', 'finance', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
    );

    if (!isGlobal) {
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

    // Check permissions: ONLY admin (General Manager) can edit student details.
    if (supervisor.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل بيانات الطلاب، التعديل متاح للمدير العام فقط.' }, { status: 403 });
    }

    // Auto-set registrationStatus based on paymentStatus
    let registrationStatus = body.registrationStatus;
    if (body.paymentStatus === 'paid') {
      registrationStatus = 'approved';
    } else if (body.paymentStatus === 'unpaid' || body.paymentStatus === 'apple_pay') {
      // Only override if we're explicitly changing payment status
      if (body.paymentStatus && !body.registrationStatus) {
        registrationStatus = 'pending';
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
      mapLink: body.mapLink,
      hasCondition: body.hasCondition,
      conditionNote: body.conditionNote,
      paymentStatus: body.paymentStatus,
      groupId: body.groupId !== undefined ? (body.groupId === null ? null : parseInt(body.groupId, 10)) : undefined,
      registrationStatus,
      paymentType: body.paymentType,
      paymentReceipt: body.paymentReceipt
    });

    return NextResponse.json({ success: true, student: updated });
  } catch (error) {
    console.error('students PUT error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل البيانات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    const studentName = String(body.studentName ?? '').trim();
    const nationalId = String(body.nationalId ?? '').trim();
    const guardianPhone = String(body.guardianPhone ?? '').trim();
    const studentPhone = body.studentPhone ? String(body.studentPhone).trim() : null;
    const stage = String(body.stage ?? '').trim();
    const grade = String(body.grade ?? '').trim();
    const neighborhood = String(body.neighborhood ?? '').trim();
    const mapLink = body.mapLink ? String(body.mapLink).trim() : null;
    const hasCondition = body.hasCondition === true;
    const conditionNote = body.conditionNote ? String(body.conditionNote).trim() : null;
    const paymentStatus = body.paymentStatus || 'unpaid';
    const registrationStatus = body.registrationStatus || 'approved';
    const groupId = body.groupId ? parseInt(body.groupId, 10) : null;

    if (!studentName || !nationalId || !guardianPhone || !stage || !grade || !neighborhood) {
      return NextResponse.json({ error: 'يرجى إكمال جميع الحقول الإلزامية' }, { status: 400 });
    }

    const created = await createStudentManually({
      studentName,
      nationalId,
      guardianPhone,
      studentPhone,
      stage,
      grade,
      neighborhood,
      mapLink,
      hasCondition,
      conditionNote,
      paymentStatus,
      registrationStatus,
      groupId,
      locationLat: null,
      locationLng: null,
      paymentType: 'later',
      paymentReceipt: null
    });

    return NextResponse.json({ success: true, student: created });
  } catch (error) {
    console.error('students POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة الطالب' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor || supervisor.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح لك بحذف الطلاب' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '', 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'معرّف الطالب غير صحيح' }, { status: 400 });
    }

    const success = await deleteStudent(id);
    if (!success) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('students DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الطالب' }, { status: 500 });
  }
}
