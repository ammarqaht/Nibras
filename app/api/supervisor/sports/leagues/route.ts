import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getSportLeagues, getSportLeagueById, createSportLeague,
  updateSportLeague, deleteSportLeague,
} from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const stage = new URL(req.url).searchParams.get('stage') || undefined;
    const leagues = await getSportLeagues(stage);
    return NextResponse.json({ leagues });
  } catch (e) {
    console.error('sports/leagues GET', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { stage, title, pointsEnabled, winPoints, drawPoints, lossPoints } = await req.json();
    if (!stage || !title) return NextResponse.json({ error: 'المرحلة والعنوان مطلوبان' }, { status: 400 });
    const league = await createSportLeague({
      stage, title,
      pointsEnabled: pointsEnabled ?? true,
      winPoints: winPoints ?? 2,
      drawPoints: drawPoints ?? 1,
      lossPoints: lossPoints ?? 0,
    });
    return NextResponse.json({ league });
  } catch (e) {
    console.error('sports/leagues POST', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
    const league = await updateSportLeague(Number(id), patch);
    return NextResponse.json({ league });
  } catch (e) {
    console.error('sports/leagues PATCH', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const id = parseInt(new URL(req.url).searchParams.get('id') ?? '', 10);
    if (isNaN(id)) return NextResponse.json({ error: 'id غير صالح' }, { status: 400 });
    await deleteSportLeague(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('sports/leagues DELETE', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
