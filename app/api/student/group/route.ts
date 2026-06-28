import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getStudents, getStudentGroup } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const students = await getStudents();
  const student = students.find(s => s.id === session.id);
  if (!student || !student.groupId) {
    return NextResponse.json({ group: null });
  }

  const data = await getStudentGroup(student.groupId);
  if (!data) return NextResponse.json({ group: null });

  return NextResponse.json({
    group: {
      id: data.group.id,
      name: data.group.name,
      stage: data.group.stage,
    },
    supervisor: data.supervisor ? {
      id: data.supervisor.id,
      name: data.supervisor.name,
    } : null,
    members: data.members.map(m => ({
      id: m.id,
      membershipNo: m.membershipNo,
      name: m.studentName,
      grade: m.grade,
    })),
  });
}
