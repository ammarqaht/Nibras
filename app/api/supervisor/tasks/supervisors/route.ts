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
    const seenNames = new Set<string>();
    const list = [];
    for (const s of supervisors) {
      if (!s.name) continue;
      const cleanName = s.name.trim();
      if (seenNames.has(cleanName)) continue;
      seenNames.add(cleanName);
      list.push({
        id: s.id,
        name: cleanName,
        email: s.email,
        role: s.role,
      });
    }

    return NextResponse.json({ supervisors: list });
  } catch (error) {
    console.error('tasks supervisors GET error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل قائمة المشرفين' }, { status: 500 });
  }
}
