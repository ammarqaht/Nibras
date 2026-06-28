import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getStudents,
  getAttendance,
  getPoints,
  getTasks,
  getSubmissions,
  getSchedules,
  getGroups,
  getInvoices,
  getAnnouncements,
  getAllSupervisors,
  getSupervisorByEmail,
  getSettings
} from '@/lib/services';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supervisor = await getSupervisorByEmail(session.email);
    if (!supervisor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = supervisor.role.split(',').map(r => r.trim());
    // Global roles see all students' data without scoping to a group/stage
    const isGlobal = roles.some(r =>
      ['admin', 'finance', 'finance_supervisor', 'media_supervisor',
       'cultural_supervisor', 'social_supervisor', 'scientific_supervisor',
       'sports_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
    );

    const isFinanceRole = roles.some(r => ['finance', 'finance_supervisor'].includes(r));
    const isAdminRole = roles.includes('admin');

    // Fetch only what this role needs — reduces DB load and cold-start time
    const [
      students,
      attendance,
      points,
      tasks,
      submissions,
      schedules,
      groups,
      invoices,
      announcements
    ] = await Promise.all([
      getStudents(),
      getAttendance(),
      getPoints(),
      // Tasks/submissions only needed by roles that manage them
      (isGlobal || roles.includes('stage_supervisor') || roles.includes('groups_supervisor'))
        ? getTasks() : Promise.resolve([]),
      (isGlobal || roles.includes('stage_supervisor') || roles.includes('groups_supervisor'))
        ? getSubmissions() : Promise.resolve([]),
      getSchedules(),
      getGroups(),
      // Invoices only for finance roles
      isFinanceRole ? getInvoices() : Promise.resolve([]),
      getAnnouncements()
    ]);

    const today = todayStr();

    // 1. Students & Payments (Global)
    const totalStudents = students.length;
    const approvedStudents = students.filter(s => s.registrationStatus === 'approved').length;
    const pendingStudents = students.filter(s => s.registrationStatus === 'pending').length;
    const paidStudents = students.filter(s => s.paymentStatus === 'paid').length;
    const exemptedStudents = students.filter(s => s.paymentStatus === 'exempted').length;
    const pendingReviewPayments = students.filter(s => s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted' && s.paymentType === 'now' && !!s.paymentReceipt).length;
    const conditionStudents = students.filter(s => s.hasCondition).length;

    // 2. Attendance (Global)
    const todayAttendanceAll = attendance.filter(a => a.date === today);
    const presentCountAll = todayAttendanceAll.filter(a => a.status === 'present').length;
    const absentCountAll  = todayAttendanceAll.filter(a => a.status === 'absent').length;
    const lateCountAll    = todayAttendanceAll.filter(a => a.status === 'late').length;
    const excusedCountAll = todayAttendanceAll.filter(a => a.status === 'excused').length;

    // Scoped / Family calculations
    let myStudentsList: any[] = [];
    let presentCount = presentCountAll;
    let absentCount  = absentCountAll;
    let lateCount    = lateCountAll;
    let excusedCount = excusedCountAll;
    const activeBaseAll = Math.max(paidStudents + exemptedStudents, 1);
    let activeBase = activeBaseAll;
    let activeTasksCount = tasks.filter(t => t.isActive).length;
    let pendingSubmissionsCount = submissions.filter(s => s.status === 'pending').length;

    if (!isGlobal) {
      const allowedGroupIds = supervisor.groupIds
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));

      const myStudents = students.filter(s => s.groupId !== null && allowedGroupIds.includes(s.groupId));
      myStudentsList = myStudents.map(s => ({
        id: s.id,
        studentName: s.studentName,
        stage: s.stage,
        grade: s.grade,
        membershipNo: s.membershipNo
      }));

      const myStudentIds = myStudents.map(s => s.id);
      const todayAttendance = attendance.filter(a => a.date === today && myStudentIds.includes(a.registrationId));
      presentCount = todayAttendance.filter(a => a.status === 'present').length;
      absentCount  = todayAttendance.filter(a => a.status === 'absent').length;
      lateCount    = todayAttendance.filter(a => a.status === 'late').length;
      excusedCount = todayAttendance.filter(a => a.status === 'excused').length;
      activeBase = Math.max(myStudents.length, 1);

      activeTasksCount = tasks.filter(t => t.isActive && (t.visibility === 'all' || t.visibleToIds.some(id => allowedGroupIds.includes(id)))).length;
      pendingSubmissionsCount = submissions.filter(sub => sub.status === 'pending' && myStudentIds.includes(sub.registrationId)).length;
    }

    // 3. Points
    const pointsToday = points.filter(p => p.createdAt.startsWith(today)).reduce((sum, p) => sum + p.delta, 0);
    
    // Top group points
    const groupPointsMap: Record<number, number> = {};
    for (const g of groups) groupPointsMap[g.id] = 0;
    
    // Map student to group
    const studentGroupMap: Record<number, number> = {};
    for (const s of students) {
      if (s.groupId != null) {
        studentGroupMap[s.id] = s.groupId;
      }
    }
    
    for (const p of points) {
      const gId = studentGroupMap[p.registrationId];
      if (gId) groupPointsMap[gId] = (groupPointsMap[gId] || 0) + p.delta;
    }
    
    let topGroup = null;
    let maxPoints = -1;
    for (const g of groups) {
      if (groupPointsMap[g.id] > maxPoints) {
        maxPoints = groupPointsMap[g.id];
        topGroup = g.name;
      }
    }

    // 5. Schedule
    const todaySchedules = schedules.filter(s => s.date === today);
    const todayScheduleCount = todaySchedules.length;
    let nextProgramTitle = null;
    const sortedTodaySchedules = todaySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (todayScheduleCount > 0) {
      nextProgramTitle = sortedTodaySchedules[0]?.title;
    }

    // 6. Groups
    const totalGroups = groups.length;

    // 7. Finance & Invoices
    const pendingInvoices = invoices.filter(i => i.status === 'pending').length;
    const approvedInvoices = invoices.filter(i => i.status === 'approved');
    const totalSpent = approvedInvoices.reduce((sum, i) => sum + i.total, 0);

    // 8. Announcements
    const recentAnnouncements = announcements.length;
    const announcementsList = announcements.slice(0, 5).map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      imageUrl: a.imageUrl,
      createdAt: a.createdAt
    }));

    // --- Role-specific extras ---
    const isAttendanceRole = roles.includes('attendance_supervisor');
    const isStageRole = roles.includes('stage_supervisor');
    const committeeRoles = ['social_supervisor', 'cultural_supervisor', 'scientific_supervisor', 'sports_supervisor', 'media_supervisor'];
    const myCommitteeRoles = roles.filter(r => committeeRoles.includes(r));

    // FINANCE: net balance + this-month expenses
    let financeStats: { netBalance: number; thisMonthExpenses: number } | null = null;
    if (isFinanceRole) {
      const settings = await getSettings();
      const clubFee = parseInt(settings.clubFeesValue || '300', 10);
      const studentRevenue = paidStudents * clubFee;
      const thisMonth = today.substring(0, 7); // YYYY-MM
      const thisMonthExpenses = approvedInvoices
        .filter((i: any) => (i.createdAt as string).startsWith(thisMonth))
        .reduce((sum: number, i: any) => sum + i.total, 0);
      financeStats = { netBalance: studentRevenue - totalSpent, thisMonthExpenses };
    }

    // ATTENDANCE: avg last 7 days + consecutive absent count
    let attendanceStats: { avg7DayAttendance: number; consecutiveAbsentCount: number } | null = null;
    if (isAttendanceRole) {
      const last7: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last7.push(d.toISOString().split('T')[0]);
      }
      const dayRates = last7.map(day => {
        const recs = attendance.filter((a: any) => a.date === day);
        const p = recs.filter((a: any) => a.status === 'present' || a.status === 'late').length;
        return recs.length > 0 ? (p / recs.length) * 100 : null;
      }).filter((v): v is number => v !== null);
      const avg7DayAttendance = dayRates.length > 0
        ? Math.round(dayRates.reduce((a, b) => a + b, 0) / dayRates.length) : 0;

      const last30: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last30.push(d.toISOString().split('T')[0]);
      }
      const approvedList = students.filter((s: any) => s.registrationStatus === 'approved');
      let consecutiveAbsentCount = 0;
      for (const student of approvedList) {
        const absentDates = attendance
          .filter((a: any) => a.registrationId === student.id && a.status === 'absent' && last30.includes(a.date))
          .map((a: any) => a.date).sort();
        let streak = 1, maxStreak = 0;
        for (let i = 1; i < absentDates.length; i++) {
          const diff = (new Date(absentDates[i]).getTime() - new Date(absentDates[i - 1]).getTime()) / 86400000;
          if (diff === 1) { streak++; maxStreak = Math.max(maxStreak, streak); }
          else streak = 1;
        }
        if (maxStreak >= 2) consecutiveAbsentCount++;
      }
      attendanceStats = { avg7DayAttendance, consecutiveAbsentCount };
    }

    // COMMITTEE: next upcoming program for the supervisor's committee role(s)
    let nextCommitteeProgram: { title: string; date: string; startTime: string } | null = null;
    if (myCommitteeRoles.length > 0) {
      const upcoming = schedules
        .filter((s: any) => s.date >= today && myCommitteeRoles.includes(s.role))
        .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      if (upcoming.length > 0) {
        nextCommitteeProgram = { title: upcoming[0].title, date: upcoming[0].date, startTime: upcoming[0].startTime };
      }
    }

    // GROUPS: rank and points for the supervisor's own group
    let groupStats: { myGroupRank: number | null; myGroupPoints: number } | null = null;
    if (roles.includes('groups_supervisor') && supervisor.groupIds) {
      const myGroupId = parseInt(supervisor.groupIds.split(',')[0].trim(), 10);
      if (!isNaN(myGroupId)) {
        const ranked = groups
          .map((g: any) => ({ id: g.id, points: groupPointsMap[g.id] || 0 }))
          .sort((a: any, b: any) => b.points - a.points);
        const rankIdx = ranked.findIndex((g: any) => g.id === myGroupId);
        groupStats = { myGroupRank: rankIdx >= 0 ? rankIdx + 1 : null, myGroupPoints: groupPointsMap[myGroupId] || 0 };
      }
    }

    // STAGE: stage-specific approved count, today attendance, top 3 by points
    let stageStats: {
      stageName: string;
      approvedCount: number;
      attendanceToday: { present: number; late: number; excused: number; absent: number };
      top3: { name: string; points: number }[];
    } | null = null;
    if (isStageRole && supervisor.stage) {
      const stageStudents = students.filter((s: any) => s.stage === supervisor.stage);
      const stageApprovedCount = stageStudents.filter((s: any) => s.registrationStatus === 'approved').length;
      const stageStudentIds = new Set(stageStudents.map((s: any) => s.id));
      const stageTodayAtt = attendance.filter((a: any) => a.date === today && stageStudentIds.has(a.registrationId));
      const studentPointsSums: Record<number, number> = {};
      for (const p of points) {
        if (stageStudentIds.has(p.registrationId)) {
          studentPointsSums[p.registrationId] = (studentPointsSums[p.registrationId] || 0) + p.delta;
        }
      }
      const top3 = stageStudents
        .filter((s: any) => s.registrationStatus === 'approved')
        .map((s: any) => ({ name: s.studentName, points: studentPointsSums[s.id] || 0 }))
        .sort((a: any, b: any) => b.points - a.points)
        .slice(0, 3);
      stageStats = {
        stageName: supervisor.stage,
        approvedCount: stageApprovedCount,
        attendanceToday: {
          present: stageTodayAtt.filter((a: any) => a.status === 'present').length,
          late:    stageTodayAtt.filter((a: any) => a.status === 'late').length,
          excused: stageTodayAtt.filter((a: any) => a.status === 'excused').length,
          absent:  stageTodayAtt.filter((a: any) => a.status === 'absent').length
        },
        top3
      };
    }

    return NextResponse.json({
      isGlobal,
      stats: {
        myStudents: myStudentsList,
        students: { total: totalStudents, approved: approvedStudents, pending: pendingStudents, conditions: conditionStudents },
        payments: { paid: paidStudents, exempted: exemptedStudents, pendingReview: pendingReviewPayments },
        attendance: { presentToday: presentCount, absentToday: absentCount, lateToday: lateCount, excusedToday: excusedCount, activeBase },
        attendanceOverall: { presentToday: presentCountAll, absentToday: absentCountAll, lateToday: lateCountAll, excusedToday: excusedCountAll, activeBase: activeBaseAll },
        points: { today: pointsToday, topGroup: topGroup, topGroupPoints: maxPoints },
        tasks: { active: activeTasksCount, pendingReview: pendingSubmissionsCount },
        schedule: { todayCount: todayScheduleCount, nextProgramTitle, todayPrograms: sortedTodaySchedules },
        groups: { total: totalGroups },
        invoices: { pendingReview: pendingInvoices, totalSpent },
        announcements: { total: recentAnnouncements, announcementsList },
        financeStats,
        attendanceStats,
        nextCommitteeProgram,
        groupStats,
        stageStats
      }
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

