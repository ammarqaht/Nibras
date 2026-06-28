import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubmissions, upsertSubmission } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    let list = await getSubmissions();
    if (taskId) {
      list = list.filter(s => s.taskId === taskId);
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
