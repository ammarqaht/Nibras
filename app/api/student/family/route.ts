import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getStudents, getStudentFamily } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const students = await getStudents();
  const student = students.find(s => s.id === session.id);
  if (!student || !student.groupId) {
    return NextResponse.json({ group: null });
  }

  const data = await getStudentFamily(student.groupId);
  if (!data) return NextResponse.json({ group: null });

  return NextResponse.json(data);
}
