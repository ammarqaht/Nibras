import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, saveSetting } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await getSetting('leaderboard_disabled_stages');
  const disabledStages: string[] = raw ? JSON.parse(raw) : [];
  return NextResponse.json({ disabledStages });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roles = session.role.split(',').map(r => r.trim());
  const isAdmin = roles.includes('admin');
  const isStageSup = roles.includes('stage_supervisor');

  if (!isAdmin && !isStageSup) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json();
  const { stage, disabled } = body;
  if (!stage || typeof disabled !== 'boolean') {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
  }

  const raw = await getSetting('leaderboard_disabled_stages');
  let disabledStages: string[] = raw ? JSON.parse(raw) : [];

  if (disabled) {
    if (!disabledStages.includes(stage)) disabledStages.push(stage);
  } else {
    disabledStages = disabledStages.filter(s => s !== stage);
  }

  await saveSetting('leaderboard_disabled_stages', JSON.stringify(disabledStages));
  return NextResponse.json({ ok: true, disabledStages });
}
