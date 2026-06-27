import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getSportMatches, getSportMatchById, createSportMatch,
  updateSportMatch, deleteSportMatch,
} from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const leagueId = parseInt(new URL(req.url).searchParams.get('leagueId') ?? '', 10);
    if (isNaN(leagueId)) return NextResponse.json({ error: 'leagueId مطلوب' }, { status: 400 });
    const matches = await getSportMatches(leagueId);
    return NextResponse.json({ matches });
  } catch (e) {
    console.error('sports/matches GET', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { leagueId, matchday, homeGroupId, awayGroupId, notes } = await req.json();
    if (!leagueId || !homeGroupId || !awayGroupId)
      return NextResponse.json({ error: 'بيانات المباراة غير مكتملة' }, { status: 400 });
    if (homeGroupId === awayGroupId)
      return NextResponse.json({ error: 'لا يمكن إضافة مباراة بين فريقين متطابقين' }, { status: 400 });
    const match = await createSportMatch({
      leagueId: Number(leagueId), matchday: Number(matchday) || 1,
      homeGroupId: Number(homeGroupId), awayGroupId: Number(awayGroupId),
      notes: notes || null,
    });
    return NextResponse.json({ match });
  } catch (e) {
    console.error('sports/matches POST', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
    const updated = await updateSportMatch(Number(id), patch);
    if (!updated) return NextResponse.json({ error: 'المباراة غير موجودة' }, { status: 404 });
    return NextResponse.json({ match: updated });
  } catch (e) {
    console.error('sports/matches PATCH', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const id = parseInt(new URL(req.url).searchParams.get('id') ?? '', 10);
    if (isNaN(id)) return NextResponse.json({ error: 'id غير صالح' }, { status: 400 });
    await deleteSportMatch(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('sports/matches DELETE', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
