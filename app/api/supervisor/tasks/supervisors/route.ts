import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllSupervisors } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const supervisors = await getAllSupervisors();
    // Only return IDs and names for grading assignment
    const list = supervisors.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
    }));

    return NextResponse.json({ supervisors: list });
  } catch (error) {
    console.error('tasks supervisors GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل قائمة المشرفين' }, { status: 500 });
  }
}
