import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateSubmission, deleteSubmission } from '@/lib/services';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

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
