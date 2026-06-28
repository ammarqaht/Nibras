import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getStudents, getStudentPoints, calcPointSummary, getSetting } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const students = await getStudents();
  const student = students.find(s => s.id === session.id);
  if (!student) return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });

  const points = await getStudentPoints(session.id);
  const summary = calcPointSummary(points);

  const hidePoints = (await getSetting('hide_points')) === '1';
  const hidePointsMessage = (await getSetting('hide_points_message')) || 'النقاط مخفية مؤقتاً… استمر في التميّز، وسيتم الكشف عنها قريباً! 🌟';

  return NextResponse.json({
    id: student.id,
    membershipNo: student.membershipNo,
    name: student.studentName,
    stage: student.stage,
    grade: student.grade,
    groupId: student.groupId,
    hidePoints,
    hidePointsMessage,
    ...summary,
  });
}
