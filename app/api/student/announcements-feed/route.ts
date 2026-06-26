import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getAnnouncements } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const all = await getAnnouncements();
  const visible = all.filter(a => {
    const aud = (a.audience || '').toLowerCase();
    if (!aud) return true;
    return aud === 'all' || aud === 'students' || aud === 'الكل' || aud === 'الطلاب' || aud.includes('student') || aud.includes('طالب');
  });

  visible.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return NextResponse.json({
    announcements: visible.map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      imageUrl: a.imageUrl ?? null,
      images: a.images ?? null,
      createdAt: a.createdAt,
    })),
  });
}
