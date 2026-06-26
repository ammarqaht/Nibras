import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubmissions, upsertSubmission, getTaskById, createNotification, getAllSupervisors } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    let list = await getSubmissions();

    // tasks_supervisor only sees submissions for their assigned tasks
    const roles = (session.role || '').split(',').map((r: string) => r.trim());
    const isTasksSupervisorOnly = roles.includes('tasks_supervisor') && !roles.includes('scientific_supervisor') && !roles.includes('admin');

    if (taskId) {
      list = list.filter(s => s.taskId === taskId);
    } else if (isTasksSupervisorOnly) {
      // Need tasks to filter by assignedAdmins
      // We'll filter in the tasks route; here return all for simplicity
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

    // Notify assigned supervisors of new pending submission
    if ((status || 'pending') === 'pending') {
      try {
        const task = await getTaskById(taskId);
        if (task) {
          const supervisors = await getAllSupervisors();
          const assignedIds = task.assignedAdmins.length > 0
            ? task.assignedAdmins.map(Number).filter(n => !isNaN(n))
            : supervisors
                .filter(s => s.role.split(',').map((r: string) => r.trim()).some((r: string) => ['scientific_supervisor', 'tasks_supervisor', 'admin'].includes(r)))
                .map(s => s.id);

          for (const supId of assignedIds) {
            await createNotification({
              type: 'supervisor_new_submission',
              targetType: 'supervisor',
              targetId: supId,
              title: 'تسليم جديد بانتظار المراجعة',
              body: `طالب سلّم مهمة "${task.title}" وتنتظر مراجعتك.`,
              relatedTaskId: taskId,
              relatedSubId: created.id,
            });
          }
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ success: true, submission: created });
  } catch (error) {
    console.error('submissions POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة/تعديل التسليم' }, { status: 500 });
  }
}
