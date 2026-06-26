import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getStudentTasksWithSubmissions } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await getStudentTasksWithSubmissions(session.id, session.stage);
  return NextResponse.json({ tasks: data });
}
