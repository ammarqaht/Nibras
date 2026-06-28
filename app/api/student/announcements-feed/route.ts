import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getAnnouncements, getStudents, getGroups } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const students = await getStudents();
  const student = students.find(s => s.id === session.id);
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const groups = await getGroups();
  const group = student.groupId ? groups.find(g => g.id === student.groupId) : null;

  const all = await getAnnouncements();
  const visible = all.filter(a => {
    const aud = (a.audience || '').trim().toLowerCase();
    if (!aud) return true;
    
    if (aud === 'all' || aud === 'students' || aud === 'الكل' || aud === 'الطلاب' || aud.includes('student') || aud.includes('طالب')) {
      return true;
    }

    const targets = aud.split(',').map(t => t.trim().toLowerCase());
    const studentStage = student.stage.trim().toLowerCase();
    const groupName = group ? group.name.trim().toLowerCase() : '';

    return targets.some(t => {
      if (t.startsWith('stage:')) {
        return t === `stage:${studentStage}`;
      }
      if (t.startsWith('group:')) {
        return groupName && t === `group:${groupName}`;
      }
      return t === studentStage || (groupName && t === groupName);
    });
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
