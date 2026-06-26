import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getStageLeaderboard, getSetting } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if leaderboard is disabled for this stage
  const disabledRaw = await getSetting('leaderboard_disabled_stages');
  const disabledStages: string[] = disabledRaw ? JSON.parse(disabledRaw) : [];
  if (disabledStages.includes(session.stage)) {
    return NextResponse.json({ disabled: true, leaderboard: [] });
  }

  const leaderboard = await getStageLeaderboard(session.stage);
  return NextResponse.json({ disabled: false, leaderboard, stage: session.stage });
}
