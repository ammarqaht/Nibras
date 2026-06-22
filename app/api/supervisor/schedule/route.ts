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

    // Verify supervisor has the role or is admin
    if (session.role !== 'admin') {
      const userRoles = session.role.split(',').map(r => r.trim());
      if (!userRoles.includes(role)) {
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

    // Optional: add authorization to check if this user owns the schedule or is admin
    // For now we trust the client or only allow admin/owner.
    // If we wanted to be strict, we'd fetch the schedule by ID first.
    // Given the simple system, let's allow it but we could restrict it.
    // Let's do a quick check:
    if (session.role !== 'admin') {
      const all = await getSchedules();
      const target = all.find(s => s.id === id);
      if (target && target.supervisorId !== session.id) {
        return NextResponse.json({ error: 'لا يمكنك حذف برنامج لم تقم بإنشائه' }, { status: 403 });
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

    // Verify supervisor has the role or is admin
    if (session.role !== 'admin') {
      const userRoles = session.role.split(',').map(r => r.trim());
      if (!userRoles.includes(role)) {
        return NextResponse.json({ error: 'لا تملك الصلاحية للتعديل بهذا الدور' }, { status: 403 });
      }

      // Check if they are the owner of the schedule
      const all = await getSchedules();
      const target = all.find(s => s.id === id);
      if (target && target.supervisorId !== session.id) {
        return NextResponse.json({ error: 'لا يمكنك تعديل برنامج لم تقم بإنشائه' }, { status: 403 });
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
