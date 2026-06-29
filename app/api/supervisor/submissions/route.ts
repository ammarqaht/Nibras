import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubmissions, upsertSubmission, getTasks } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    let list = await getSubmissions();

    // Supervisors who are not admin or scientific_supervisor only see submissions for their assigned tasks
    const roles = (session.role || '').split(',').map((r: string) => r.trim());
    const isSpecialist = !roles.includes('scientific_supervisor') && !roles.includes('admin');

    if (taskId) {
      list = list.filter(s => s.taskId === taskId);
    } else if (isSpecialist) {
      const supervisorId = String(session.id);
      const allTasks = await getTasks();
      const myTaskIds = new Set(
        allTasks
          .filter(t => t.assignedAdmins.length === 0 || t.assignedAdmins.map(String).includes(supervisorId))
          .map(t => t.id)
      );
      list = list.filter(s => myTaskIds.has(s.taskId));
    }

    return NextResponse.json({ submissions: list });
  } catch (error) {
    console.error('submissions GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل التسليمات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const body = await req.json();
    const { registrationId, taskId, fileUrl, selectedAdminId, status, grade, feedback } = body;

    const regId = parseInt(registrationId, 10);
    if (isNaN(regId) || !taskId) {
      return NextResponse.json({ error: 'البيانات غير كاملة' }, { status: 400 });
    }

    const gradeVal = grade !== undefined && grade !== null ? parseInt(grade, 10) : null;

    const created = await upsertSubmission({
      registrationId: regId,
      taskId,
      fileUrl: fileUrl || 'admin://manual-mark',
      status: status || 'pending',
      grade: gradeVal,
      feedback: feedback || null,
      selectedAdminId: selectedAdminId || String(session.id),
    });

    return NextResponse.json({ success: true, submission: created });
  } catch (error) {
    console.error('submissions POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة/تعديل التسليم' }, { status: 500 });
  }
}
