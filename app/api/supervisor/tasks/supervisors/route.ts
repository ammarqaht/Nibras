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
    // Only return supervisors who are scientific_supervisor or tasks_supervisor
    const TASKS_ROLES = ['scientific_supervisor', 'tasks_supervisor', 'admin'];
    const list = supervisors
      .filter(s => s.role.split(',').map((r: string) => r.trim()).some((r: string) => TASKS_ROLES.includes(r)))
      .map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
      }));

    return NextResponse.json({ supervisors: list });
  } catch (error) {
    console.error('tasks supervisors GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل قائمة المشرفين' }, { status: 500 });
  }
}
