import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, saveSetting } from '@/lib/services';

const DEFAULTS = {
  earlyBefore:    '08:00',
  lateAfter:      '08:15',
  earlyPoints:    '3',
  onTimePoints:   '2',
  latePoints:     '1',
};

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const s = await getSettings();
  return NextResponse.json({
    earlyBefore:  s.att_earlyBefore  ?? DEFAULTS.earlyBefore,
    lateAfter:    s.att_lateAfter    ?? DEFAULTS.lateAfter,
    earlyPoints:  Number(s.att_earlyPoints  ?? DEFAULTS.earlyPoints),
    onTimePoints: Number(s.att_onTimePoints ?? DEFAULTS.onTimePoints),
    latePoints:   Number(s.att_latePoints   ?? DEFAULTS.latePoints),
  });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const roles = session.role?.split(',').map((r: string) => r.trim()) ?? [];
  const isAdmin = roles.includes('admin');
  const isAttendance = roles.some((r: string) =>
    ['admin', 'attendance_supervisor', 'stage_supervisor', 'groups_supervisor'].includes(r)
  );
  if (!isAdmin && !isAttendance) {
    return NextResponse.json({ error: 'غير مصرح لك بتعديل إعدادات الحضور' }, { status: 403 });
  }

  const body = await req.json();
  const { earlyBefore, lateAfter, earlyPoints, onTimePoints, latePoints } = body;

  if (earlyBefore)  await saveSetting('att_earlyBefore',  earlyBefore);
  if (lateAfter)    await saveSetting('att_lateAfter',    lateAfter);
  if (earlyPoints  !== undefined) await saveSetting('att_earlyPoints',  String(earlyPoints));
  if (onTimePoints !== undefined) await saveSetting('att_onTimePoints', String(onTimePoints));
  if (latePoints   !== undefined) await saveSetting('att_latePoints',   String(latePoints));

  return NextResponse.json({ success: true });
}
