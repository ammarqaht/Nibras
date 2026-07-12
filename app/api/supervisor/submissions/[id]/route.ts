import { NextRequest, NextResponse, after } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateSubmission, deleteSubmission, getSubmissionById, getTasks, createNotification, deleteTaskAwardPoints, addPointsRecord } from '@/lib/services';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Fetch existing submission to detect status change and get student/task info
    const existing = await getSubmissionById(id);

    // Grading roles (scientific/tasks/admin) may grade any submission. Any other
    // supervisor may grade a submission only if its task is assigned to them
    // (assignedAdmins empty = open to all, otherwise must include their id).
    const roles = (session.role || '').split(',').map((r: string) => r.trim());
    let canGrade = roles.some(r => ['scientific_supervisor', 'tasks_supervisor', 'admin'].includes(r));
    if (!canGrade && existing) {
      const task = (await getTasks()).find(t => t.id === existing.taskId);
      const assigned = (task?.assignedAdmins ?? []).map(String);
      if (task && (assigned.length === 0 || assigned.includes(String(session.id)))) {
        canGrade = true;
      }
    }
    if (!canGrade) {
      return NextResponse.json({ error: 'لا تملك صلاحية تصحيح هذه المهمة' }, { status: 403 });
    }

    // Rejecting a submission requires a reason for the student
    if (body.status === 'rejected' && !String(body.feedback ?? '').trim()) {
      return NextResponse.json({ error: 'يجب إضافة سبب رد المهمة' }, { status: 400 });
    }

    const patch: any = {};
    if (body.status !== undefined) patch.status = body.status;
    if (body.feedback !== undefined) patch.feedback = body.feedback;
    if (body.fileUrl !== undefined) patch.fileUrl = body.fileUrl;
    if (body.selectedAdminId !== undefined) patch.selectedAdminId = body.selectedAdminId;
    if (body.grade !== undefined) {
      patch.grade = body.grade !== null ? parseInt(body.grade, 10) : null;
    }

    // Cap grade at 50% for late submissions — supervisor cannot give full marks after the late window
    if (existing?.wasLate && typeof patch.grade === 'number' && existing.taskMaxPoints) {
      const cap = Math.floor(existing.taskMaxPoints / 2);
      if (patch.grade > cap) {
        return NextResponse.json({ error: `التسليم متأخر — الحد الأقصى للنقاط ${cap} من ${existing.taskMaxPoints}` }, { status: 400 });
      }
    }

    const updated = await updateSubmission(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'التسليم غير موجود' }, { status: 404 });
    }

    const statusChanged = existing && body.status && body.status !== existing.status;
    const newStatus = body.status;

    // Add points when approved. Clear any prior award for this task first so a
    // re-grade or a reject→approve cycle can't stack points twice (idempotent).
    if (statusChanged && newStatus === 'approved') {
      const grade = patch.grade ?? 0;
      // Award points via a direct DB write (no self HTTP round trip). Clearing
      // any prior award first keeps it idempotent.
      try {
        await deleteTaskAwardPoints(updated.registrationId, updated.taskTitle);
        if (grade > 0) {
          await addPointsRecord({
            registrationId: updated.registrationId,
            delta: grade,
            reason: `إنجاز مهمة: ${updated.taskTitle}`,
            category: 'tasks',
            pointType: 'individual',
            recordedBy: session.name,
          });
        }
      } catch { /* non-fatal */ }

      // Notify the student after responding — grading shouldn't wait on it.
      after(async () => {
        try {
          await createNotification({
            type: 'student_graded',
            targetType: 'student',
            targetId: updated.registrationId,
            title: 'تم قبول مهمتك',
            body: `تم قبول تسليمك لمهمة "${updated.taskTitle}" وحصلت على ${grade} نقطة.`,
            relatedTaskId: updated.taskId,
            relatedSubId: updated.id,
          });
        } catch { /* non-fatal */ }
      });
    }

    // Notify student about rejection
    if (statusChanged && newStatus === 'rejected') {
      // If this submission had already been approved, remove the points it earned
      // so a rejected task doesn't keep awarding points.
      if (existing?.status === 'approved') {
        try { await deleteTaskAwardPoints(updated.registrationId, updated.taskTitle); } catch { /* non-fatal */ }
      }
      after(async () => {
        try {
          const note = body.feedback ? ` — ملاحظة: ${body.feedback}` : '';
          await createNotification({
            type: 'student_graded',
            targetType: 'student',
            targetId: updated.registrationId,
            title: 'تم رد مهمتك',
            body: `تم رد تسليمك لمهمة "${updated.taskTitle}"${note}. يمكنك إعادة التسليم.`,
            relatedTaskId: updated.taskId,
            relatedSubId: updated.id,
          });
        } catch { /* non-fatal */ }
      });
    }

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    console.error('submission PUT error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تقييم التسليم' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { id } = await params;
    const ok = await deleteSubmission(id);
    if (!ok) {
      return NextResponse.json({ error: 'التسليم غير موجود أو فشل الحذف' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('submission DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف التسليم' }, { status: 500 });
  }
}
