import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { getStudentPoints, calcPointSummary, getCategoryLabelMap } from '@/lib/services';

export async function GET(req: NextRequest) {
  const session = getStudentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [rawPoints, labelMap] = await Promise.all([
    getStudentPoints(session.id),
    getCategoryLabelMap(),
  ]);

  // Attach an Arabic label for each category so the student UI never shows a
  // raw key (e.g. "cat_ind_..." or "participation").
  const points = rawPoints.map(p => ({
    ...p,
    categoryLabel: labelMap[p.category] || p.category,
  }));
  const summary = calcPointSummary(rawPoints);

  return NextResponse.json({ points, summary });
}
