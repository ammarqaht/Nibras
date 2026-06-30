import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSchedules, createSchedule, deleteSchedule, updateSchedule } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const schedules = await getSchedules();
    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('schedules GET error', error);
    return NextResponse.json({ error: 'حدث خطأ في جلب الجدول' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    const { title, date, startTime, endTime, role, stage, notes } = body;

    if (!title || !date || !startTime || !endTime || !role) {
      return NextResponse.json({ error: 'البيانات غير كاملة' }, { status: 400 });
    }

    const userRoles = session.role.split(',').map(r => r.trim());
    const allowedRoles = [
      'admin', 'cultural_supervisor', 'sports_supervisor', 'social_supervisor', 'scientific_supervisor',
      'media_supervisor', 'groups_supervisor', 'attendance_supervisor', 'general_supervisor', 'family_supervisor'
    ];
    const canManage = userRoles.some(r => allowedRoles.includes(r));
    if (!canManage) {
      return NextResponse.json({ error: 'غير مصرح لك بإضافة برامج للجدول' }, { status: 403 });
    }

    if (session.role !== 'admin') {
      const isMediaOfficer = userRoles.includes('general_supervisor') || userRoles.includes('media_officer');
      const isAllowedRole = userRoles.includes(role) || (isMediaOfficer && role === 'media_supervisor');
      if (!isAllowedRole) {
        return NextResponse.json({ error: 'لا تملك الصلاحية للإضافة بهذا الدور' }, { status: 403 });
      }
    }

    const schedule = await createSchedule({
      title,
      date,
      startTime,
      endTime,
      role,
      supervisorId: session.id,
      stage: stage || 'الكل',
      notes: notes || null
    });
    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error('schedules POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة البرنامج' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'معرف البرنامج مطلوب' }, { status: 400 });
    }

    const userRoles = session.role.split(',').map(r => r.trim());
    const allowedRoles = [
      'admin', 'cultural_supervisor', 'sports_supervisor', 'social_supervisor', 'scientific_supervisor',
      'media_supervisor', 'groups_supervisor', 'attendance_supervisor', 'general_supervisor', 'family_supervisor'
    ];
    const canManage = userRoles.some(r => allowedRoles.includes(r));
    if (!canManage) {
      return NextResponse.json({ error: 'غير مصرح لك بحذف برامج الجدول' }, { status: 403 });
    }

    if (session.role !== 'admin') {
      const isMediaOfficer = userRoles.includes('general_supervisor') || userRoles.includes('media_officer');
      const all = await getSchedules();
      const target = all.find(s => s.id === id);
      if (target) {
        const isAllowedRole = userRoles.includes(target.role) || (isMediaOfficer && target.role === 'media_supervisor');
        if (!isAllowedRole) {
          return NextResponse.json({ error: 'لا يمكنك حذف برامج اللجان الأخرى' }, { status: 403 });
        }
      }
    }

    const success = await deleteSchedule(id);
    if (!success) {
      return NextResponse.json({ error: 'البرنامج غير موجود أو فشل الحذف' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('schedules DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف البرنامج' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, date, startTime, endTime, role, stage, notes } = body;

    if (!id || !title || !date || !startTime || !endTime || !role) {
      return NextResponse.json({ error: 'البيانات غير كاملة' }, { status: 400 });
    }

    const userRoles = session.role.split(',').map(r => r.trim());
    const allowedRoles = [
      'admin', 'cultural_supervisor', 'sports_supervisor', 'social_supervisor', 'scientific_supervisor',
      'media_supervisor', 'groups_supervisor', 'attendance_supervisor', 'general_supervisor', 'family_supervisor'
    ];
    const canManage = userRoles.some(r => allowedRoles.includes(r));
    if (!canManage) {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل برامج الجدول' }, { status: 403 });
    }

    if (session.role !== 'admin') {
      const isMediaOfficer = userRoles.includes('general_supervisor') || userRoles.includes('media_officer');
      const isAllowedRole = userRoles.includes(role) || (isMediaOfficer && role === 'media_supervisor');
      if (!isAllowedRole) {
        return NextResponse.json({ error: 'لا تملك الصلاحية للتعديل بهذا الدور' }, { status: 403 });
      }

      // Check if they are allowed to modify this schedule (must belong to their committee)
      const all = await getSchedules();
      const target = all.find(s => s.id === id);
      if (target) {
        const isTargetAllowed = userRoles.includes(target.role) || (isMediaOfficer && target.role === 'media_supervisor');
        if (!isTargetAllowed) {
          return NextResponse.json({ error: 'لا يمكنك تعديل برامج اللجان الأخرى' }, { status: 403 });
        }
      }
    }

    const schedule = await updateSchedule(id, {
      title,
      date,
      startTime,
      endTime,
      role,
      stage: stage || 'الكل',
      notes: notes || null
    });

    if (!schedule) {
      return NextResponse.json({ error: 'البرنامج غير موجود أو فشل التعديل' }, { status: 404 });
    }

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error('schedules PUT error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل البرنامج' }, { status: 500 });
  }
}
