import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import {
  getSubmissions, claimTask, submitClaim, cancelClaim,
  createNotification, getAllSupervisors, getTasks,
} from '@/lib/services';

export async function POST(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action, taskId, fileUrl } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    // ── Claim (request) a task ──
    if (action === 'claim') {
      const { submission, error } = await claimTask(session.id, taskId);
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ ok: true, submission });
    }

    // ── Cancel an active claim (half the cost is refunded) ──
    if (action === 'cancel') {
      const { ok, error } = await cancelClaim(session.id, taskId);
      if (!ok) return NextResponse.json({ error: error || 'تعذّر إلغاء المهمة' }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ── Submit a previously-claimed task ──
    if (!fileUrl) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }
    const { submission, error } = await submitClaim(session.id, taskId, fileUrl);
    if (error || !submission) {
      return NextResponse.json({ error: error || 'فشل التسليم' }, { status: 400 });
    }

    // Notify assigned supervisors
    const tasks = await getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const supervisors = await getAllSupervisors();
      const TASKS_ROLES = ['scientific_supervisor', 'tasks_supervisor', 'admin'];
      const assignedIds = task.assignedAdmins.length > 0
        ? task.assignedAdmins.map(Number).filter(n => !isNaN(n))
        : supervisors
            .filter(s => s.role.split(',').map(r => r.trim()).some(r => TASKS_ROLES.includes(r)))
            .map(s => s.id);

      for (const supId of assignedIds) {
        await createNotification({
          type: 'supervisor_new_submission',
          targetType: 'supervisor',
          targetId: supId,
          title: 'تسليم مهمة جديد',
          body: `قدّم ${session.name} تسليمًا للمهمة "${task.title}"`,
          relatedTaskId: taskId,
          relatedSubId: submission.id,
        });
      }
    }

    return NextResponse.json({ ok: true, submission });
  } catch {
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const all = await getSubmissions();
  const mine = all.filter(s => s.registrationId === session.id);
  return NextResponse.json({ submissions: mine });
}
