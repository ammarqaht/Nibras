import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, saveSetting } from '@/lib/services';

const DEFAULT_MSG = 'النقاط مخفية مؤقتاً… استمر في التميّز، وسيتم الكشف عنها قريباً! 🌟';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const hidden = (await getSetting('hide_points')) === '1';
  const message = (await getSetting('hide_points_message')) || DEFAULT_MSG;
  return NextResponse.json({ hidden, message });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const roles = (session.role || '').split(',').map((r: string) => r.trim());
  if (!roles.some((r: string) => ['admin', 'stage_supervisor'].includes(r))) {
    return NextResponse.json({ error: 'غير مصرح لك بهذا الإجراء' }, { status: 403 });
  }
  const { hidden, message } = await req.json();
  await saveSetting('hide_points', hidden ? '1' : '0');
  if (typeof message === 'string' && message.trim()) await saveSetting('hide_points_message', message.trim());
  return NextResponse.json({ hidden: !!hidden, message: (message || DEFAULT_MSG) });
}
