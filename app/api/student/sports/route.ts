import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import {
  getSportLeagues, getSportMatches, getLeagueStandings,
  getGroups,
} from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const stage = session.stage;
    const leagues = await getSportLeagues(stage);
    const activeLeague = leagues.find(l => l.status === 'active') || leagues[0] || null;

    if (!activeLeague) {
      return NextResponse.json({ league: null, standings: [], matches: [], groups: [] });
    }

    const [matches, standings, groups] = await Promise.all([
      getSportMatches(activeLeague.id),
      getLeagueStandings(activeLeague.id),
      getGroups(),
    ]);

    const stageGroups = groups.filter(g => g.stage === stage);
    const groupMap = Object.fromEntries(stageGroups.map(g => [g.id, g.name]));

    const enrichedStandings = standings.map((s, i) => ({
      rank: i + 1,
      ...s,
      groupName: groupMap[s.groupId] || `فريق ${s.groupId}`,
      isMyGroup: session.groupId === s.groupId,
    }));

    const enrichedMatches = matches.map(m => ({
      ...m,
      homeName: groupMap[m.homeGroupId] || `فريق ${m.homeGroupId}`,
      awayName: groupMap[m.awayGroupId] || `فريق ${m.awayGroupId}`,
      isMyMatch: session.groupId === m.homeGroupId || session.groupId === m.awayGroupId,
    }));

    return NextResponse.json({
      league: activeLeague,
      standings: enrichedStandings,
      matches: enrichedMatches,
      groups: stageGroups,
    });
  } catch (e) {
    console.error('student/sports GET', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
