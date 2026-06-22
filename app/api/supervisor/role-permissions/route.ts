import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, saveSetting, getAllSupervisors, DEFAULT_ROLE_PERMISSIONS } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const supervisors = await getAllSupervisors();
    const currentUser = supervisors.find(s => s.id === session.id);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'صلاحيات غير كافية' }, { status: 403 });
    }

    const settings = await getSettings();
    let map = DEFAULT_ROLE_PERMISSIONS;
    if (settings.role_permissions) {
      try {
        map = JSON.parse(settings.role_permissions);
      } catch {}
    }
    return NextResponse.json({ permissions: map });
  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const supervisors = await getAllSupervisors();
    const currentUser = supervisors.find(s => s.id === session.id);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'صلاحيات غير كافية' }, { status: 403 });
    }

    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
    }

    await saveSetting('role_permissions', JSON.stringify(body));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
