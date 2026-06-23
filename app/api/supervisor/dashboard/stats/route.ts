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
  getSupervisorByEmail
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
    const isGlobal = roles.some(r =>
      ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
    );

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
    const absentCountAll = todayAttendanceAll.filter(a => a.status === 'absent').length;

    // Scoped / Family calculations
    let myStudentsList: any[] = [];
    let presentCount = presentCountAll;
    let absentCount = absentCountAll;
    let activeBase = Math.max(paidStudents + exemptedStudents, 1);
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
      absentCount = todayAttendance.filter(a => a.status === 'absent').length;
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
    if (todayScheduleCount > 0) {
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
      isGlobal,
      stats: {
        myStudents: myStudentsList,
        students: { total: totalStudents, approved: approvedStudents, pending: pendingStudents, conditions: conditionStudents },
        payments: { paid: paidStudents, exempted: exemptedStudents, pendingReview: pendingReviewPayments },
        attendance: { presentToday: presentCount, absentToday: absentCount, activeBase },
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

