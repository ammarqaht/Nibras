import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getStudentPoints, calcPointSummary } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const points = await getStudentPoints(session.id);
  const summary = calcPointSummary(points);

  return NextResponse.json({ points, summary });
}
