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
  getAllSupervisors
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

    // Parallel fetch all data for the dashboard
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
      getTasks(),
      getSubmissions(),
      getSchedules(),
      getGroups(),
      getInvoices(),
      getAnnouncements()
    ]);

    const today = todayStr();

    // 1. Students & Payments
    const totalStudents = students.length;
    const approvedStudents = students.filter(s => s.registrationStatus === 'approved').length;
    const pendingStudents = students.filter(s => s.registrationStatus === 'pending').length;
    const paidStudents = students.filter(s => s.paymentStatus === 'paid').length;
    const pendingReviewPayments = students.filter(s => s.paymentStatus !== 'paid' && s.paymentType === 'now' && !!s.paymentReceipt).length;
    const conditionStudents = students.filter(s => s.hasCondition).length;

    // 2. Attendance
    const todayAttendance = attendance.filter(a => a.date === today);
    const presentCount = todayAttendance.filter(a => a.status === 'present').length;
    const absentCount = todayAttendance.filter(a => a.status === 'absent').length;

    // 3. Points
    // Calculate total points given today
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

    // 4. Tasks & Submissions
    const activeTasksCount = tasks.filter(t => t.isActive).length;
    const pendingSubmissionsCount = submissions.filter(s => s.status === 'pending').length;

    // 5. Schedule
    const todaySchedules = schedules.filter(s => s.date === today);
    const todayScheduleCount = todaySchedules.length;
    let nextProgramTitle = null;
    if (todayScheduleCount > 0) {
      // Find the one closest to now, or just the first one
      nextProgramTitle = todaySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime))[0]?.title;
    }

    // 6. Groups
    const totalGroups = groups.length;

    // 7. Finance & Invoices
    const pendingInvoices = invoices.filter(i => i.status === 'pending').length;
    const approvedInvoices = invoices.filter(i => i.status === 'approved');
    const totalSpent = approvedInvoices.reduce((sum, i) => sum + i.total, 0);

    // 8. Announcements
    const recentAnnouncements = announcements.length;

    return NextResponse.json({
      stats: {
        students: { total: totalStudents, approved: approvedStudents, pending: pendingStudents, conditions: conditionStudents },
        payments: { paid: paidStudents, pendingReview: pendingReviewPayments },
        attendance: { presentToday: presentCount, absentToday: absentCount, activeBase: Math.max(approvedStudents, 1) },
        points: { today: pointsToday, topGroup: topGroup, topGroupPoints: maxPoints },
        tasks: { active: activeTasksCount, pendingReview: pendingSubmissionsCount },
        schedule: { todayCount: todayScheduleCount, nextProgramTitle },
        groups: { total: totalGroups },
        invoices: { pendingReview: pendingInvoices, totalSpent },
        announcements: { total: recentAnnouncements }
      }
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
