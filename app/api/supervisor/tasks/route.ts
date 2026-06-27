import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTasks, createTask, getSettings, saveSetting } from '@/lib/services';

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

    // tasks_supervisor only sees tasks assigned to them
    const roles = (session.role || '').split(',').map((r: string) => r.trim());
    const isTasksSupervisor = roles.includes('tasks_supervisor') && !roles.includes('scientific_supervisor') && !roles.includes('admin');
    if (isTasksSupervisor) {
      const supervisorId = String(session.id);
      list = list.filter(t => t.assignedAdmins.includes(supervisorId));
    }

    // Return task categories from settings
    const settings = await getSettings();
    const categories: string[] = JSON.parse(settings.task_categories ?? '["عام","ديني","علمي","رياضي","ثقافي","اجتماعي"]');

    return NextResponse.json({ tasks: list, categories });
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

    // Only scientific_supervisor and admin can create tasks
    const roles = (session.role || '').split(',').map((r: string) => r.trim());
    if (!roles.some((r: string) => ['scientific_supervisor', 'admin'].includes(r))) {
      return NextResponse.json({ error: 'غير مصرح لك بإنشاء المهام' }, { status: 403 });
    }

    const body = await req.json();

    // Handle category save
    if (body.action === 'save_categories') {
      const cats = Array.isArray(body.categories) ? body.categories : [];
      await saveSetting('task_categories', JSON.stringify(cats));
      return NextResponse.json({ success: true });
    }

    const { title, description, maxPoints, startDate, dueDate, track, stage, cost, durationHours, submissionMethod, assignedAdmins, imageUrl, resourceLink, visibility, visibleToIds } = body;

    if (!title || !description || !maxPoints || !dueDate) {
      return NextResponse.json({ error: 'البيانات غير كاملة' }, { status: 400 });
    }

    const maxPtsVal = parseInt(maxPoints, 10);
    if (isNaN(maxPtsVal) || maxPtsVal <= 0) {
      return NextResponse.json({ error: 'الحد الأقصى للنقاط يجب أن يكون رقماً أكبر من صفر' }, { status: 400 });
    }

    const tasks = await getTasks();
    const isDuplicate = tasks.some(t => t.title.trim() === title.trim() && t.dueDate.split('T')[0] === dueDate.split('T')[0]);
    if (isDuplicate) {
      return NextResponse.json({ error: 'مهمة مكررة: تم نشر مهمة بنفس العنوان وتاريخ الاستحقاق مسبقاً' }, { status: 400 });
    }

    const created = await createTask({
      title: title.trim(),
      description: description.trim(),
      maxPoints: maxPtsVal,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      dueDate: new Date(dueDate).toISOString(),
      track: track?.trim() || 'عام',
      stage: stage || null,
      cost: Number.isFinite(Number(cost)) ? Math.max(0, parseInt(cost, 10) || 0) : 0,
      durationHours: durationHours != null && durationHours !== '' ? Math.max(0, parseInt(durationHours, 10) || 0) || null : null,
      isActive: true,
      submissionMethod: submissionMethod || 'file',
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
