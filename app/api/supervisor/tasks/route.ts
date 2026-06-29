import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTasks, createTask } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let list = await getTasks();
    if (activeOnly) {
      list = list.filter(t => t.isActive);
    }

    return NextResponse.json({ tasks: list });
  } catch (error) {
    console.error('tasks GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المهام' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, maxPoints, dueDate, track, submissionMethod, timeLimitHours, assignedAdmins, imageUrl, resourceLink, visibility, visibleToIds } = body;

    if (!title || !description || !maxPoints || !dueDate) {
      return NextResponse.json({ error: 'البيانات غير كاملة' }, { status: 400 });
    }

    const maxPtsVal = parseInt(maxPoints, 10);
    if (isNaN(maxPtsVal) || maxPtsVal <= 0) {
      return NextResponse.json({ error: 'الحد الأقصى للنقاط يجب أن يكون رقماً أكبر من صفر' }, { status: 400 });
    }

    // Check duplicates: title + date
    const tasks = await getTasks();
    const isDuplicate = tasks.some(t => t.title.trim() === title.trim() && t.dueDate.split('T')[0] === dueDate.split('T')[0]);
    if (isDuplicate) {
      return NextResponse.json({ error: 'مهمة مكررة: تم نشر مهمة بنفس العنوان وتاريخ الاستحقاق مسبقاً' }, { status: 400 });
    }

    const created = await createTask({
      title: title.trim(),
      description: description.trim(),
      maxPoints: maxPtsVal,
      startDate: body.startDate || null,
      dueDate: new Date(dueDate).toISOString(),
      track: track ? track.trim() : 'عام',
      isActive: true,
      submissionMethod: submissionMethod || 'رفع ملف',
      durationHours: timeLimitHours ? parseInt(timeLimitHours, 10) : null,
      assignedAdmins: Array.isArray(assignedAdmins) ? assignedAdmins.map(String) : [],
      imageUrl: imageUrl || null,
      resourceLink: resourceLink || null,
      visibility: visibility || 'all',
      visibleToIds: Array.isArray(visibleToIds) ? visibleToIds.map(Number) : [],
    });

    return NextResponse.json({ success: true, task: created });
  } catch (error) {
    console.error('tasks POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة المهمة' }, { status: 500 });
  }
}
