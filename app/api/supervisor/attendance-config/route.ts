import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, saveSetting } from '@/lib/services';

export const dynamic = 'force-dynamic';

const DEFAULTS = {
  attendanceStart: '07:30',
  lateAfter:       '08:15',
  onTimePoints:    '2',
  latePoints:      '1',
  excusedPoints:   '0',
};

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const s = await getSettings();
  return NextResponse.json({
    attendanceStart: s.att_attendanceStart  ?? DEFAULTS.attendanceStart,
    lateAfter:       s.att_lateAfter        ?? DEFAULTS.lateAfter,
    onTimePoints:    Number(s.att_onTimePoints  ?? DEFAULTS.onTimePoints),
    latePoints:      Number(s.att_latePoints    ?? DEFAULTS.latePoints),
    excusedPoints:   Number(s.att_excusedPoints ?? DEFAULTS.excusedPoints),
  });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const roles = session.role?.split(',').map((r: string) => r.trim()) ?? [];
  const isAttendance = roles.some((r: string) =>
    ['admin', 'attendance_supervisor', 'stage_supervisor', 'groups_supervisor'].includes(r)
  );
  if (!isAttendance) {
    return NextResponse.json({ error: 'غير مصرح لك بتعديل إعدادات الحضور' }, { status: 403 });
  }

  const body = await req.json();
  const { attendanceStart, lateAfter, onTimePoints, latePoints, excusedPoints } = body;

  if (attendanceStart !== undefined) await saveSetting('att_attendanceStart',  attendanceStart);
  if (lateAfter       !== undefined) await saveSetting('att_lateAfter',        lateAfter);
  if (onTimePoints    !== undefined) await saveSetting('att_onTimePoints',      String(onTimePoints));
  if (latePoints      !== undefined) await saveSetting('att_latePoints',        String(latePoints));
  if (excusedPoints   !== undefined) await saveSetting('att_excusedPoints',     String(excusedPoints));

  return NextResponse.json({ success: true });
}
