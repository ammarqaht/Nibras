'use client';

import { useEffect, useState } from 'react';
import { useStudent } from './layout';

type ScheduleItem = { id: string; title: string; startTime: string; endTime: string; role: string; notes?: string | null };
type AttendanceItem = { id: number; date: string; status: string };

const ROLE_LABELS: Record<string, string> = {
  social_supervisor: 'اجتماعية',
  cultural_supervisor: 'ثقافية',
  scientific_supervisor: 'علمية',
  sports_supervisor: 'رياضية',
  media_supervisor: 'إعلامية',
  general_supervisor: 'عام',
  stage_supervisor: 'مرحلة',
};

const ROLE_COLORS: Record<string, string> = {
  social_supervisor: '#E52E25',
  cultural_supervisor: '#22c55e',
  scientific_supervisor: '#103F91',
  sports_supervisor: '#FF9F1C',
  media_supervisor: '#12B3D5',
  general_supervisor: '#6B6B6B',
  stage_supervisor: '#7c3aed',
};

export default function StudentHome() {
  const { user } = useStudent();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [loadingSched, setLoadingSched] = useState(true);
  const [loadingAtt, setLoadingAtt] = useState(true);

  useEffect(() => {
    fetch('/api/student/schedule')
      .then(r => r.json())
      .then(d => setSchedule(d.schedule || []))
      .finally(() => setLoadingSched(false));

    fetch('/api/student/attendance')
      .then(r => r.json())
      .then(d => setAttendance(d.attendance || []))
      .finally(() => setLoadingAtt(false));
  }, []);

  const todayStr = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const totalSessions = attendance.length;
  const attendancePct = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Greeting */}
      {user && (
        <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--blue) 0%, #1a5bb5 100%)' }}>
          <div className="absolute top-0 left-0 w-40 h-40 rounded-full opacity-10" style={{ background: 'var(--accent)', transform: 'translate(-30%, -30%)' }} />
          <p className="text-sm opacity-80 mb-1">{todayStr}</p>
          <h1 className="text-xl font-bold mb-3">أهلاً، {user.name} 👋</h1>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{user.balance}</p>
              <p className="text-xs opacity-75 mt-1">الرصيد الكلي</p>
            </div>
            <div className="w-px bg-white opacity-20" />
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{user.rankScore}</p>
              <p className="text-xs opacity-75 mt-1">نقاط الترتيب</p>
            </div>
            <div className="w-px bg-white opacity-20" />
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{attendancePct}%</p>
              <p className="text-xs opacity-75 mt-1">الحضور</p>
            </div>
          </div>
        </div>
      )}

      {/* Attendance summary */}
      <div className="card p-4">
        <h2 className="font-bold mb-3" style={{ color: 'var(--ink)' }}>سجل الحضور</h2>
        {loadingAtt ? (
          <p className="text-sm text-center py-3" style={{ color: 'var(--ink-soft)' }}>جارٍ التحميل...</p>
        ) : totalSessions === 0 ? (
          <p className="text-sm text-center py-3" style={{ color: 'var(--ink-soft)' }}>لا يوجد سجل حضور بعد.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'حضر', count: presentCount, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'متأخر', count: lateCount, color: '#d97706', bg: '#fffbeb' },
              { label: 'غاب', count: absentCount, color: 'var(--red)', bg: '#fef2f2' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: item.bg }}>
                <p className="text-2xl font-bold" style={{ color: item.color, fontFamily: 'var(--font-display)' }}>{item.count}</p>
                <p className="text-xs mt-1" style={{ color: item.color }}>{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's schedule */}
      <div className="card p-4">
        <h2 className="font-bold mb-3" style={{ color: 'var(--ink)' }}>برنامج اليوم</h2>
        {loadingSched ? (
          <p className="text-sm text-center py-3" style={{ color: 'var(--ink-soft)' }}>جارٍ التحميل...</p>
        ) : schedule.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>لا يوجد برنامج محدد لليوم.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedule.map(item => {
              const color = ROLE_COLORS[item.role] || 'var(--ink-soft)';
              const label = ROLE_LABELS[item.role] || item.role;
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'var(--bg-soft)' }}>
                  <div className="w-1 rounded-full self-stretch mt-1" style={{ background: color, minHeight: '2.5rem' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{item.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                      {item.startTime} – {item.endTime} · <span style={{ color }}>{label}</span>
                    </p>
                    {item.notes && <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>{item.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
