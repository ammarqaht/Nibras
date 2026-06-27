/**
 * Unified endpoint for match events: goals, cards, behavior notes
 * POST  { type:'goal'|'card'|'behavior', ...data }
 * DELETE ?type=goal|card|behavior&id=X
 * GET   ?type=cards|behaviors&leagueId=X   /   ?type=goals&matchId=X
 * PATCH { type:'card', id, suspensionServed } — mark suspension served
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getSportGoals, getSportGoalsByLeague, addSportGoal, deleteSportGoal,
  getSportCards, addSportCard, updateSportCard, deleteSportCard,
  getSportBehaviors, addSportBehavior, deleteSportBehavior,
} from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const params = new URL(req.url).searchParams;
    const type = params.get('type');
    if (type === 'goals') {
      const leagueId = params.get('leagueId') ? parseInt(params.get('leagueId')!, 10) : undefined;
      const matchId  = params.get('matchId')  ? parseInt(params.get('matchId')!,  10) : undefined;
      if (leagueId !== undefined) return NextResponse.json({ goals: await getSportGoalsByLeague(leagueId) });
      if (matchId  !== undefined) return NextResponse.json({ goals: await getSportGoals(matchId) });
      return NextResponse.json({ error: 'matchId أو leagueId مطلوب' }, { status: 400 });
    }
    if (type === 'cards') {
      const leagueId = params.get('leagueId') ? parseInt(params.get('leagueId')!, 10) : undefined;
      const matchId  = params.get('matchId')  ? parseInt(params.get('matchId')!,  10) : undefined;
      return NextResponse.json({ cards: await getSportCards({ leagueId, matchId }) });
    }
    if (type === 'behaviors') {
      const leagueId = parseInt(params.get('leagueId') ?? '', 10);
      if (isNaN(leagueId)) return NextResponse.json({ error: 'leagueId مطلوب' }, { status: 400 });
      return NextResponse.json({ behaviors: await getSportBehaviors(leagueId) });
    }
    return NextResponse.json({ error: 'type غير صالح' }, { status: 400 });
  } catch (e) {
    console.error('sports/events GET', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const body = await req.json();
    const { type } = body;

    if (type === 'goal') {
      const { matchId, teamGroupId, scorerName, scorerId } = body;
      if (!matchId || !teamGroupId || !scorerName)
        return NextResponse.json({ error: 'بيانات الهدف غير مكتملة' }, { status: 400 });
      const goal = await addSportGoal({
        matchId: Number(matchId), teamGroupId: Number(teamGroupId),
        scorerName, scorerId: scorerId ? Number(scorerId) : null,
        createdBy: session.name,
      });
      return NextResponse.json({ goal });
    }

    if (type === 'card') {
      const { matchId, leagueId, studentId, studentName, groupId, cardType } = body;
      if (!matchId || !leagueId || !studentName || !groupId || !cardType)
        return NextResponse.json({ error: 'بيانات البطاقة غير مكتملة' }, { status: 400 });

      // Auto-suspension: red → 1 match; 2nd yellow in league → 1 match
      let suspensionMatches = 0;
      if (cardType === 'red') {
        suspensionMatches = 1;
      } else if (cardType === 'yellow') {
        const prevCards = await getSportCards({ leagueId: Number(leagueId) });
        const prevYellows = prevCards.filter(c => c.studentId === Number(studentId) && c.cardType === 'yellow');
        if (prevYellows.length % 2 === 1) suspensionMatches = 1; // 2nd, 4th, ... yellow
      }

      const card = await addSportCard({
        matchId: Number(matchId), leagueId: Number(leagueId),
        studentId: Number(studentId), studentName, groupId: Number(groupId),
        cardType, suspensionMatches, createdBy: session.name,
      });
      return NextResponse.json({ card });
    }

    if (type === 'behavior') {
      const { leagueId, matchId, studentId, studentName, groupId, behaviorType, description } = body;
      if (!leagueId || !studentName || !groupId || !behaviorType || !description)
        return NextResponse.json({ error: 'بيانات الملاحظة غير مكتملة' }, { status: 400 });
      const behavior = await addSportBehavior({
        leagueId: Number(leagueId), matchId: matchId ? Number(matchId) : null,
        studentId: Number(studentId), studentName, groupId: Number(groupId),
        type: behaviorType, description, createdBy: session.name,
      });
      return NextResponse.json({ behavior });
    }

    return NextResponse.json({ error: 'type غير صالح' }, { status: 400 });
  } catch (e) {
    console.error('sports/events POST', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { type, id, ...patch } = await req.json();
    if (type === 'card') {
      const card = await updateSportCard(Number(id), patch);
      return NextResponse.json({ card });
    }
    return NextResponse.json({ error: 'type غير صالح' }, { status: 400 });
  } catch (e) {
    console.error('sports/events PATCH', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const params = new URL(req.url).searchParams;
    const type = params.get('type');
    const id   = parseInt(params.get('id') ?? '', 10);
    if (isNaN(id)) return NextResponse.json({ error: 'id غير صالح' }, { status: 400 });

    if (type === 'goal')     { await deleteSportGoal(id);     return NextResponse.json({ success: true }); }
    if (type === 'card')     { await deleteSportCard(id);     return NextResponse.json({ success: true }); }
    if (type === 'behavior') { await deleteSportBehavior(id); return NextResponse.json({ success: true }); }
    return NextResponse.json({ error: 'type غير صالح' }, { status: 400 });
  } catch (e) {
    console.error('sports/events DELETE', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
