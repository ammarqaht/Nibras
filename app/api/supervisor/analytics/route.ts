import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getStudents, getAttendance, getPoints, getTasks, getSubmissions,
  getGroups, getSupervisorByEmail, getInvoices, getGeneralExpenses,
  getOtherRevenues, getSchedules, getSettings, FINANCE_ANALYTICS_ROLES,
} from '@/lib/services';
import { DEPARTMENTS, CATEGORIES } from '@/lib/finance';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateNDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function weekLabel(dateStr: string) {
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

const STAGES = ['ابتدائي', 'متوسط', 'ثانوي'] as const;
const STAGE_GRADES: Record<string, string[]> = {
  'ابتدائي': ['رابع ابتدائي','خامس ابتدائي','سادس ابتدائي'],
  'متوسط': ['أول متوسط','ثاني متوسط','ثالث متوسط'],
  'ثانوي': ['أول ثانوي','ثاني ثانوي','ثالث ثانوي'],
};
const SCHEDULE_ROLES: Record<string, string> = {
  social_supervisor: 'الاجتماعية',
  cultural_supervisor: 'الثقافية',
  media_supervisor: 'الإعلامية',
  groups_supervisor: 'الأسر',
  attendance_supervisor: 'التحضير',
  general_supervisor: 'الإدارة',
  scientific_supervisor: 'العلمية',
  sports_supervisor: 'الرياضية',
  administrative_supervisor: 'الإدارية',
};

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roles = supervisor.role.split(',').map((r: string) => r.trim());
    const canSeeFinance = roles.some((r: string) => FINANCE_ANALYTICS_ROLES.includes(r));

    // Only fetch financial data for roles that need it
    const [students, attendance, points, tasks, submissions, groups, invoices, generalExpenses, otherRevenues, schedules, settings] =
      await Promise.all([
        getStudents(), getAttendance(), getPoints(), getTasks(), getSubmissions(),
        getGroups(),
        canSeeFinance ? getInvoices() : Promise.resolve([]),
        canSeeFinance ? getGeneralExpenses() : Promise.resolve([]),
        canSeeFinance ? getOtherRevenues() : Promise.resolve([]),
        getSchedules(),
        canSeeFinance ? getSettings() : Promise.resolve({} as any),
      ]);

    const today = todayStr();

    // ── helpers ──────────────────────────────────────────────────────────────
    const studentMap: Record<number, any> = {};
    for (const s of students) studentMap[s.id] = s;

    const studentGroupMap: Record<number, number> = {};
    for (const s of students) { if (s.groupId != null) studentGroupMap[s.id] = s.groupId; }

    // ── SECTION 1: REGISTRATION ──────────────────────────────────────────────
    const approved  = students.filter((s: any) => s.registrationStatus === 'approved');
    const pending   = students.filter((s: any) => s.registrationStatus === 'pending');
    const rejected  = students.filter((s: any) => s.registrationStatus === 'rejected');
    const paid      = students.filter((s: any) => s.paymentStatus === 'paid');
    const exempted  = students.filter((s: any) => s.paymentStatus === 'exempted');
    const pendingPay = students.filter((s: any) =>
      s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted' && s.paymentType === 'now' && !!s.paymentReceipt);
    const unpaid    = students.filter((s: any) =>
      s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted' &&
      !(s.paymentType === 'now' && !!s.paymentReceipt));
    const withCondition = students.filter((s: any) => s.hasCondition);
    const unassigned = students.filter((s: any) => s.groupId == null && s.registrationStatus === 'approved');

    // Stage + grade breakdown
    const byStage: Record<string, { total: number; grades: Record<string, number> }> = {};
    for (const stage of STAGES) {
      const ss = students.filter((s: any) => s.stage === stage);
      const grades: Record<string, number> = {};
      for (const g of (STAGE_GRADES[stage] || [])) grades[g] = 0;
      for (const s of ss) grades[s.grade] = (grades[s.grade] || 0) + 1;
      byStage[stage] = { total: ss.length, grades };
    }

    // Top neighborhoods (top 8)
    const neighborhoodMap: Record<string, number> = {};
    for (const s of students) {
      if (s.neighborhood) neighborhoodMap[s.neighborhood] = (neighborhoodMap[s.neighborhood] || 0) + 1;
    }
    const topNeighborhoods = Object.entries(neighborhoodMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // Health condition list
    const conditionList = withCondition.map((s: any) => ({
      id: s.id, name: s.studentName, stage: s.stage, grade: s.grade,
      membershipNo: s.membershipNo, condition: s.conditionNote || 'غير محدد',
    }));

    // ── SECTION 2: FINANCE ───────────────────────────────────────────────────
    const fee = parseInt(String(settings?.clubFeesValue || '300').replace(/[^\d]/g, ''), 10) || 300;
    const studentRevenue = paid.length * fee;
    const otherRevenueTotal = otherRevenues.reduce((s: number, r: any) => s + r.amount, 0);
    const otherRevenueList = otherRevenues.map((r: any) => ({ title: r.title, amount: r.amount, date: r.date }));
    const totalRevenue = studentRevenue + otherRevenueTotal;

    const approvedInvoices = invoices.filter((i: any) => i.status === 'approved');
    const invoiceTotalSpent = approvedInvoices.reduce((s: number, i: any) => s + i.total, 0);
    const generalExpenseTotal = generalExpenses.reduce((s: number, e: any) => s + e.amount, 0);
    const totalExpenses = invoiceTotalSpent + generalExpenseTotal;

    // By department (committee)
    const byDepartment = DEPARTMENTS.map((d) => {
      const deptInvoices = approvedInvoices.filter((i: any) => i.department === d.key);
      return { key: d.key, label: d.label, total: deptInvoices.reduce((s: number, i: any) => s + i.total, 0), count: deptInvoices.length };
    }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);

    // By category
    const byCategory = CATEGORIES.map((c) => {
      const catInvoices = approvedInvoices.filter((i: any) => i.category === c.key);
      return { key: c.key, label: c.label, total: catInvoices.reduce((s: number, i: any) => s + i.total, 0), count: catInvoices.length };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

    const pendingInvoicesCount = invoices.filter((i: any) => i.status === 'pending').length;

    // ── SECTION 3: ATTENDANCE ────────────────────────────────────────────────
    const last14Dates = Array.from({ length: 14 }, (_, i) => dateNDaysAgo(13 - i));

    // Overall last 14 days
    const last14Overall = last14Dates.map((date) => {
      const day = attendance.filter((a: any) => a.date === date);
      const present = day.filter((a: any) => a.status === 'present').length;
      const absent  = day.filter((a: any) => a.status === 'absent').length;
      const late    = day.filter((a: any) => a.status === 'late').length;
      return { date, label: weekLabel(date), present, absent, late,
        rate: (present + absent) > 0 ? Math.round(present / (present + absent) * 100) : 0 };
    });

    // By stage last 14 days
    const last14ByStage: Record<string, { date: string; label: string; present: number; absent: number; late: number; rate: number }[]> = {};
    for (const stage of STAGES) {
      const stageIds = new Set(students.filter((s: any) => s.stage === stage).map((s: any) => s.id));
      last14ByStage[stage] = last14Dates.map((date) => {
        const day = attendance.filter((a: any) => a.date === date && stageIds.has(a.registrationId));
        const present = day.filter((a: any) => a.status === 'present').length;
        const absent  = day.filter((a: any) => a.status === 'absent').length;
        const late    = day.filter((a: any) => a.status === 'late').length;
        return { date, label: weekLabel(date), present, absent, late,
          rate: (present + absent) > 0 ? Math.round(present / (present + absent) * 100) : 0 };
      });
    }

    // Stage 7-day average
    const last7Dates = last14Dates.slice(-7);
    const stageAvg7 = STAGES.map((stage) => {
      const rows = last14ByStage[stage].slice(-7);
      const totalPresent = rows.reduce((s, r) => s + r.present, 0);
      const totalAll = rows.reduce((s, r) => s + r.present + r.absent, 0);
      return { stage, avg: totalAll > 0 ? Math.round(totalPresent / totalAll * 100) : 0 };
    });

    // Students with 2+ consecutive absences (last 30 days)
    const last30Start = dateNDaysAgo(29);
    const recentAttendance = attendance.filter((a: any) => a.date >= last30Start);
    const absentByStudent: Record<number, string[]> = {};
    for (const a of recentAttendance) {
      if (a.status === 'absent') {
        if (!absentByStudent[a.registrationId]) absentByStudent[a.registrationId] = [];
        absentByStudent[a.registrationId].push(a.date);
      }
    }
    const consecutiveAbsentStudents: { id: number; name: string; stage: string; grade: string; membershipNo: number; maxStreak: number; lastStreak: string }[] = [];
    for (const [sidStr, dates] of Object.entries(absentByStudent)) {
      const sid = parseInt(sidStr);
      const sorted = [...dates].sort();
      let streak = 1, maxStreak = 1, streakEndDate = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]), curr = new Date(sorted[i]);
        if ((curr.getTime() - prev.getTime()) / 86400000 === 1) {
          streak++;
          if (streak > maxStreak) { maxStreak = streak; streakEndDate = sorted[i]; }
        } else { streak = 1; }
      }
      if (maxStreak >= 2) {
        const st = studentMap[sid];
        if (st) consecutiveAbsentStudents.push({
          id: sid, name: st.studentName, stage: st.stage, grade: st.grade,
          membershipNo: st.membershipNo, maxStreak, lastStreak: streakEndDate,
        });
      }
    }
    consecutiveAbsentStudents.sort((a, b) => b.maxStreak - a.maxStreak);

    // ── SECTION 4: STUDENT POINTS ────────────────────────────────────────────
    const pointsByStudent: Record<number, number> = {};
    for (const p of points) pointsByStudent[p.registrationId] = (pointsByStudent[p.registrationId] || 0) + p.delta;

    const top5PerStage: Record<string, { id: number; name: string; grade: string; membershipNo: number; points: number }[]> = {};
    for (const stage of STAGES) {
      const stageStudents = students.filter((s: any) => s.stage === stage && s.registrationStatus === 'approved');
      top5PerStage[stage] = stageStudents
        .map((s: any) => ({ id: s.id, name: s.studentName, grade: s.grade, membershipNo: s.membershipNo, points: pointsByStudent[s.id] || 0 }))
        .sort((a: any, b: any) => b.points - a.points).slice(0, 5);
    }

    // Stage average points
    const stagePointsAvg = STAGES.map((stage) => {
      const ss = students.filter((s: any) => s.stage === stage && s.registrationStatus === 'approved');
      const total = ss.reduce((sum: number, s: any) => sum + (pointsByStudent[s.id] || 0), 0);
      return { stage, avg: ss.length > 0 ? Math.round(total / ss.length) : 0, total };
    });

    // Top 5 most present students (last 30 days)
    const presentByStudent: Record<number, number> = {};
    for (const a of attendance) {
      if (a.status === 'present') presentByStudent[a.registrationId] = (presentByStudent[a.registrationId] || 0) + 1;
    }
    const top5MostPresent = Object.entries(presentByStudent)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([sidStr, cnt]) => {
        const st = studentMap[parseInt(sidStr)];
        return st ? { id: st.id, name: st.studentName, stage: st.stage, grade: st.grade, membershipNo: st.membershipNo, presentDays: cnt } : null;
      }).filter(Boolean);

    // ── SECTION 5: GROUPS ────────────────────────────────────────────────────
    const groupStudentCount: Record<number, number> = {};
    for (const s of students) {
      if (s.groupId != null) groupStudentCount[s.groupId] = (groupStudentCount[s.groupId] || 0) + 1;
    }
    const groupPointsMap: Record<number, number> = {};
    for (const g of groups) groupPointsMap[g.id] = 0;
    for (const p of points) {
      const gId = studentGroupMap[p.registrationId];
      if (gId != null) groupPointsMap[gId] = (groupPointsMap[gId] || 0) + p.delta;
    }

    const groupsByStage: Record<string, any[]> = {};
    for (const stage of STAGES) {
      groupsByStage[stage] = groups
        .filter((g: any) => g.stage === stage)
        .map((g: any) => ({ id: g.id, name: g.name, stage: g.stage, studentCount: groupStudentCount[g.id] || 0, points: groupPointsMap[g.id] || 0 }))
        .sort((a: any, b: any) => b.points - a.points);
    }

    // ── SECTION 6: TASKS ─────────────────────────────────────────────────────
    const activeTasks = tasks.filter((t: any) => t.isActive);
    const expiredTasks = tasks.filter((t: any) => !t.isActive);
    const pendingSubs = submissions.filter((s: any) => s.status === 'pending');
    const approvedSubs = submissions.filter((s: any) => s.status === 'approved');
    const rejectedSubs = submissions.filter((s: any) => s.status === 'rejected');

    // Top 5 submitters
    const subsByStudent: Record<number, number> = {};
    for (const s of submissions) subsByStudent[s.registrationId] = (subsByStudent[s.registrationId] || 0) + 1;
    const top5Submitters = Object.entries(subsByStudent)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([sidStr, cnt]) => {
        const st = studentMap[parseInt(sidStr)];
        return st ? { id: st.id, name: st.studentName, stage: st.stage, grade: st.grade, membershipNo: st.membershipNo, submissionCount: cnt } : null;
      }).filter(Boolean);

    // Task completion rate per task
    const taskStats = activeTasks.slice(0, 10).map((t: any) => {
      const taskSubs = submissions.filter((s: any) => s.taskId === t.id);
      const approvedCount = taskSubs.filter((s: any) => s.status === 'approved').length;
      const eligible = approved.length;
      return {
        id: t.id, title: t.title, track: t.track || 'عام',
        total: taskSubs.length, approved: approvedCount,
        completionRate: eligible > 0 ? Math.round(approvedCount / eligible * 100) : 0,
        dueDate: t.dueDate,
      };
    }).sort((a: any, b: any) => b.completionRate - a.completionRate);

    // ── SECTION 7: SCHEDULE ──────────────────────────────────────────────────
    const totalSchedules = schedules.length;

    // Per committee
    const byCommittee: Record<string, number> = {};
    for (const s of schedules) {
      const label = SCHEDULE_ROLES[s.role] || s.role || 'أخرى';
      byCommittee[label] = (byCommittee[label] || 0) + 1;
    }
    const committeeStats = Object.entries(byCommittee)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));

    // Per week (last 6 weeks)
    const weeklyStats: { label: string; count: number }[] = [];
    for (let w = 5; w >= 0; w--) {
      const weekStart = dateNDaysAgo(w * 7 + 6);
      const weekEnd   = dateNDaysAgo(w * 7);
      const count = schedules.filter((s: any) => s.date >= weekStart && s.date <= weekEnd).length;
      weeklyStats.push({ label: `أسبوع ${6 - w}`, count });
    }

    // This week count
    const thisWeekStart = dateNDaysAgo(6);
    const thisWeekCount = schedules.filter((s: any) => s.date >= thisWeekStart && s.date <= today).length;

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      canSeeFinance,
      registration: {
        total: students.length, approved: approved.length, pending: pending.length, rejected: rejected.length,
        paid: paid.length, exempted: exempted.length, pendingPayment: pendingPay.length, unpaid: unpaid.length,
        withCondition: withCondition.length, unassigned: unassigned.length,
        byStage, topNeighborhoods, conditionList,
      },
      finance: canSeeFinance ? {
        fee, studentRevenue, otherRevenueTotal, otherRevenueList, totalRevenue,
        invoiceTotalSpent, generalExpenseTotal, totalExpenses,
        netBalance: totalRevenue - totalExpenses,
        byDepartment, byCategory, pendingInvoicesCount,
      } : null,
      attendance: {
        today: last14Overall[last14Overall.length - 1],
        last14Overall, last14ByStage, stageAvg7,
        consecutiveAbsentStudents,
      },
      studentPoints: {
        totalPoints: points.reduce((s: number, p: any) => s + p.delta, 0),
        top5PerStage, stagePointsAvg, top5MostPresent,
      },
      groups: { total: groups.length, byStage: groupsByStage },
      tasks: {
        total: tasks.length, active: activeTasks.length, expired: expiredTasks.length,
        submissions: { total: submissions.length, pending: pendingSubs.length, approved: approvedSubs.length, rejected: rejectedSubs.length },
        top5Submitters, taskStats,
      },
      schedule: { total: totalSchedules, thisWeek: thisWeekCount, byCommittee: committeeStats, byWeek: weeklyStats },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
