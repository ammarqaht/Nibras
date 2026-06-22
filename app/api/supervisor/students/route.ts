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

    const roles = supervisor.role.split(',').map(r => r.trim());
    const hasGlobalAccess = roles.some(r =>
      ['admin', 'secretary', 'finance_head', 'media_head'].includes(r)
    );

    // Identify stage heads and their allowed stages
    const allowedStages: string[] = [];
    if (roles.includes('stage_head_elementary')) allowedStages.push('ابتدائي');
    if (roles.includes('stage_head_middle')) allowedStages.push('متوسط');
    if (roles.includes('stage_head_high')) allowedStages.push('ثانوي');

    // If supervisor is a stage head and not global, only return students of their stage
    if (allowedStages.length > 0 && !hasGlobalAccess) {
      students = students.filter(s => allowedStages.includes(s.stage));
    }

    // Parse supervisor groupIds for group supervisor matching
    const supervisorGroupIds = supervisor.groupIds
      ? supervisor.groupIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
      : [];

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

    // Apply masking to sensitive fields for unauthorized students
    const maskedStudents = students.map(s => {
      // Check full details access for this student
      const hasFullAccess =
        hasGlobalAccess ||
        allowedStages.includes(s.stage) ||
        (s.groupId !== null && supervisorGroupIds.includes(s.groupId));

      return {
        ...s,
        nationalId: hasFullAccess ? s.nationalId : 'محجوب',
        guardianPhone: hasFullAccess ? s.guardianPhone : 'محجوب',
        studentPhone: s.studentPhone ? (hasFullAccess ? s.studentPhone : 'محجوب') : null
      };
    });

    return NextResponse.json({ students: maskedStudents });
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

    // Check permissions: ONLY admin (General Manager) or secretary (Club Secretary) can edit student details.
    const roles = supervisor.role.split(',').map(r => r.trim());
    if (!roles.includes('admin') && !roles.includes('secretary')) {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل بيانات الطلاب، التعديل متاح للمدير العام وأمين النادي فقط.' }, { status: 403 });
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

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    // Check permissions: ONLY admin (General Manager) or secretary (Club Secretary) can add student details manually.
    const roles = supervisor.role.split(',').map(r => r.trim());
    if (!roles.includes('admin') && !roles.includes('secretary')) {
      return NextResponse.json({ error: 'غير مصرح لك بإضافة طلاب، هذه الصلاحية للمدير العام وأمين النادي فقط.' }, { status: 403 });
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
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    const roles = supervisor.role.split(',').map(r => r.trim());
    if (!roles.includes('admin') && !roles.includes('secretary')) {
      return NextResponse.json({ error: 'غير مصرح لك بحذف الطلاب، الحذف متاح للمدير العام وأمين النادي فقط.' }, { status: 403 });
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
