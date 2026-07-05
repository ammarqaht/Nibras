import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, saveSetting } from '@/lib/services';

const DEFAULT_TRACKS = [
  { name: 'عام', images: [] },
  { name: 'الثقافي', images: [] },
  { name: 'مسار تقني', images: [] },
  { name: 'الذاكرة الحديدية', images: [] },
  { name: 'الاجتماعي', images: [] },
  { name: 'مسار إعلامي', images: [] }
];

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const raw = await getSetting('task_tracks');
    if (!raw) {
      return NextResponse.json({ tracks: DEFAULT_TRACKS });
    }

    const tracks = JSON.parse(raw);
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('tracks GET error', error);
    return NextResponse.json({ error: 'حدث خطأ في تحميل المسارات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const roles = (session.role || '').split(',').map((r: string) => r.trim());
    const isAuthorized = roles.includes('scientific_supervisor') || roles.includes('admin');
    if (!isAuthorized) {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل المسارات' }, { status: 403 });
    }

    const body = await req.json();
    const { tracks } = body;
    if (!Array.isArray(tracks)) {
      return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
    }

    // Clean / Validate tracks
    const cleanTracks = tracks.map((t: any) => {
      return {
        name: String(t.name || '').trim(),
        images: Array.isArray(t.images) ? t.images.map(String) : []
      };
    }).filter(t => t.name.length > 0);

    await saveSetting('task_tracks', JSON.stringify(cleanTracks));
    return NextResponse.json({ success: true, tracks: cleanTracks });
  } catch (error) {
    console.error('tracks POST error', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ المسارات' }, { status: 500 });
  }
}
