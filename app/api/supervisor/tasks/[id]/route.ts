import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateTask, deleteTask } from '@/lib/services';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const patch: any = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
    if (body.submissionMethod !== undefined) patch.submissionMethod = body.submissionMethod;
    if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl;
    if (body.resourceLink !== undefined) patch.resourceLink = body.resourceLink;
    if (body.visibility !== undefined) patch.visibility = body.visibility;
    if (body.visibleToIds !== undefined) patch.visibleToIds = Array.isArray(body.visibleToIds) ? body.visibleToIds.map(Number) : [];
    if (body.assignedAdmins !== undefined) patch.assignedAdmins = Array.isArray(body.assignedAdmins) ? body.assignedAdmins.map(String) : [];

    if (body.maxPoints !== undefined) {
      const maxPtsVal = parseInt(body.maxPoints, 10);
      if (!isNaN(maxPtsVal) && maxPtsVal > 0) {
        patch.maxPoints = maxPtsVal;
      }
    }
    if (body.startDate !== undefined) {
      patch.startDate = body.startDate ? new Date(body.startDate).toISOString() : null;
    }
    if (body.dueDate !== undefined) {
      patch.dueDate = new Date(body.dueDate).toISOString();
    }
    if (body.track !== undefined) patch.track = body.track;
    if (body.stage !== undefined) patch.stage = body.stage || null;
    if (body.cost !== undefined) patch.cost = Math.max(0, parseInt(body.cost, 10) || 0);
    if (body.durationHours !== undefined) patch.durationHours = body.durationHours != null && body.durationHours !== '' ? (Math.max(0, parseInt(body.durationHours, 10) || 0) || null) : null;

    const updated = await updateTask(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 444 });
    }

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error('task PUT error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل المهمة' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { id } = await params;
    const ok = await deleteTask(id);
    if (!ok) {
      return NextResponse.json({ error: 'المهمة غير موجودة أو فشل الحذف' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('task DELETE error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المهمة' }, { status: 500 });
  }
}
