import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupervisorByEmail, updateStudent } from '@/lib/services';

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'حساب غير موجود' }, { status: 401 });
    }

    const body = await req.json();
    const { assignments } = body;

    if (!Array.isArray(assignments)) {
      return NextResponse.json({ error: 'صيغة البيانات غير صحيحة' }, { status: 400 });
    }

    let successCount = 0;

    for (const item of assignments) {
      const studentId = parseInt(item.studentId, 10);
      if (isNaN(studentId)) continue;

      const groupId = item.groupId === null ? null : parseInt(item.groupId, 10);
      if (item.groupId !== null && isNaN(groupId as number)) continue;

      // Update student's groupId
      const updated = await updateStudent(studentId, {
        groupId: groupId
      });

      if (updated) {
        successCount++;
      }
    }

    return NextResponse.json({ success: true, updatedCount: successCount });
  } catch (error) {
    console.error('students bulk-group POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث الجماعي' }, { status: 500 });
  }
}
