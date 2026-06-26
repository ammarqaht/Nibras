import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getStudentFamily } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!session.groupId) {
    return NextResponse.json({ group: null });
  }

  const data = await getStudentFamily(session.groupId);
  if (!data) return NextResponse.json({ group: null });

  return NextResponse.json(data);
}
