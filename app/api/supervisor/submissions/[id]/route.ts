import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateSubmission, deleteSubmission, getSubmissionById, createNotification } from '@/lib/services';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Rejecting a submission requires a reason for the student
    if (body.status === 'rejected' && !String(body.feedback ?? '').trim()) {
      return NextResponse.json({ error: 'يجب إضافة سبب رد المهمة' }, { status: 400 });
    }

    // Fetch existing submission to detect status change and get student/task info
    const existing = await getSubmissionById(id);

    const patch: any = {};
    if (body.status !== undefined) patch.status = body.status;
    if (body.feedback !== undefined) patch.feedback = body.feedback;
    if (body.fileUrl !== undefined) patch.fileUrl = body.fileUrl;
    if (body.selectedAdminId !== undefined) patch.selectedAdminId = body.selectedAdminId;
    if (body.grade !== undefined) {
      patch.grade = body.grade !== null ? parseInt(body.grade, 10) : null;
    }

    const updated = await updateSubmission(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'التسليم غير موجود' }, { status: 404 });
    }

    const statusChanged = existing && body.status && body.status !== existing.status;
    const newStatus = body.status;

    // Add points when approved
    if (statusChanged && newStatus === 'approved') {
      const grade = patch.grade ?? 0;
      if (grade > 0) {
        try {
          await fetch(`${req.nextUrl.origin}/api/supervisor/points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
            body: JSON.stringify({
              registrationId: updated.registrationId,
              delta: grade,
              reason: `إنجاز مهمة: ${updated.taskTitle}`,
              category: 'tasks',
              pointType: 'individual',
            }),
          });
        } catch { /* non-fatal */ }
      }

      // Notify student about acceptance
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
    }

    // Notify student about rejection
    if (statusChanged && newStatus === 'rejected') {
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
