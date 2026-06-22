'use client';

import { useEffect, useState, useMemo } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type ScheduleInfo = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  supervisorId: number;
};

const ROLES = [
  { key: 'social_supervisor', label: 'اللجنة الاجتماعية', color: 'bg-red-100 text-red-800 border-red-200' },
  { key: 'cultural_supervisor', label: 'اللجنة الثقافية', color: 'bg-green-100 text-green-800 border-green-200' },
  { key: 'media_supervisor', label: 'اللجنة الإعلامية', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { key: 'groups_supervisor', label: 'لجنة الأسر', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { key: 'attendance_supervisor', label: 'لجنة التحضير', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { key: 'general_supervisor', label: 'الإدارة', color: 'bg-slate-100 text-slate-800 border-slate-300' },
];

function getRoleStyle(role: string) {
  return ROLES.find(r => r.key === role)?.color || 'bg-gray-100 text-gray-800 border-gray-200';
}
function getRoleLabel(role: string) {
  return ROLES.find(r => r.key === role)?.label || 'غير محدد';
}

function getWeekDays(startOffset = 0) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    // Start from current day or offset
    d.setDate(d.getDate() + i + startOffset);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export default function SchedulePage() {
  const { user } = useSupervisor();
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [role, setRole] = useState('');
  
  const [weekOffset, setWeekOffset] = useState(0);

  const userRoles = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return ROLES.map(r => r.key);
    return user.role.split(',').map(r => r.trim());
  }, [user]);

  const availableRoles = ROLES.filter(r => userRoles.includes(r.key));

  async function load() {
    try {
      const r = await fetch('/api/supervisor/schedule', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) {
        setSchedules(j.schedules ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAddModal(selectedDate?: string) {
    setTitle('');
    setDate(selectedDate || new Date().toISOString().split('T')[0]);
    setStartTime('16:00');
    setEndTime('17:00');
    setRole(availableRoles.length > 0 ? availableRoles[0].key : '');
    setIsModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !startTime || !endTime || !role) {
      return pushToast('error', 'يرجى إكمال جميع الحقول');
    }
    setBusy(true);
    const r = await fetch('/api/supervisor/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, startTime, endTime, role })
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return pushToast('error', j.error ?? 'فشل إضافة البرنامج');
    }
    pushToast('success', 'تمت إضافة البرنامج للجدول');
    setIsModalOpen(false);
    load();
  }

  async function removeSchedule(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا البرنامج؟')) return;
    setBusy(true);
    const r = await fetch(`/api/supervisor/schedule?id=${id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return pushToast('error', j.error ?? 'فشل الحذف');
    }
    pushToast('success', 'تم حذف البرنامج');
    load();
  }

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const schedulesByDay = useMemo(() => {
    const map: Record<string, ScheduleInfo[]> = {};
    weekDays.forEach(d => map[d] = []);
    schedules.forEach(s => {
      if (map[s.date]) {
        map[s.date].push(s);
      }
    });
    // Sort by start time
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }, [schedules, weekDays]);

  const formatDateLabel = (dStr: string) => {
    const d = new Date(dStr);
    return new Intl.DateTimeFormat('ar-SA', { weekday: 'long', month: 'short', day: 'numeric' }).format(d);
  };

  const formatTime = (time24: string) => {
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'م' : 'ص';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${hours}:${m} ${suffix}`;
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">الجدول</h1>
          <p className="text-sm text-ink-500">تنظيم البرامج والأنشطة المشتركة لمعرفة الأوقات المتاحة.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-lg border border-ink-200 overflow-hidden shadow-sm">
            <button onClick={() => setWeekOffset(o => o - 7)} className="px-3 py-1.5 hover:bg-cream-100 text-ink-600 font-bold border-l border-ink-200">{'<'}</button>
            <button onClick={() => setWeekOffset(0)} className="px-4 py-1.5 hover:bg-cream-100 text-sm font-semibold text-ink-900">الأسبوع الحالي</button>
            <button onClick={() => setWeekOffset(o => o + 7)} className="px-3 py-1.5 hover:bg-cream-100 text-ink-600 font-bold border-r border-ink-200">{'>'}</button>
          </div>
          {availableRoles.length > 0 && (
            <button onClick={() => openAddModal()} className="btn btn-primary text-sm whitespace-nowrap">
              + إضافة برنامج
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-ink-400">جارٍ تحميل الجدول...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {weekDays.map(dayDate => (
            <div key={dayDate} className="bg-white rounded-xl border border-ink-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-ink-50 border-b border-ink-200 py-2.5 px-3 flex justify-between items-center">
                <span className="font-semibold text-ink-900 text-sm">{formatDateLabel(dayDate)}</span>
                {availableRoles.length > 0 && (
                  <button onClick={() => openAddModal(dayDate)} className="text-brand-600 hover:text-brand-800 text-xl leading-none" title="إضافة برنامج في هذا اليوم">+</button>
                )}
              </div>
              <div className="p-3 flex-1 min-h-[150px] space-y-2.5 bg-cream-50/30">
                {schedulesByDay[dayDate]?.length > 0 ? (
                  schedulesByDay[dayDate].map(s => {
                    const canDelete = user?.role === 'admin' || user?.id === s.supervisorId;
                    return (
                      <div key={s.id} className={`p-2.5 rounded-lg border text-sm relative group ${getRoleStyle(s.role)}`}>
                        {canDelete && (
                          <button onClick={() => removeSchedule(s.id)} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-nred-600 hover:text-nred-800 transition-opacity bg-white/50 rounded p-1 text-xs">
                            🗑
                          </button>
                        )}
                        <div className="font-bold mb-1 pe-4">{s.title}</div>
                        <div className="text-xs font-semibold opacity-80 mb-1">{getRoleLabel(s.role)}</div>
                        <div className="text-xs opacity-90 flex items-center gap-1 font-mono" dir="ltr">
                          {formatTime(s.startTime)} - {formatTime(s.endTime)}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-ink-400 py-4">لا توجد برامج</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نافذة الإضافة */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-ink-200 flex justify-between items-center bg-ink-50">
              <h3 className="text-lg font-bold text-ink-900">إضافة برنامج للجدول</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-400 hover:text-ink-900 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="label">اسم البرنامج</label>
                <input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: دوري البلايستيشن" required />
              </div>
              <div>
                <label className="label">التاريخ</label>
                <input type="date" className="field" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">من الساعة</label>
                  <input type="time" className="field" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                </div>
                <div className="flex-1">
                  <label className="label">إلى الساعة</label>
                  <input type="time" className="field" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="label">اللجنة / الدور <span className="text-xs text-ink-400 font-normal">(الأدوار المتاحة لك فقط)</span></label>
                <select className="field" value={role} onChange={e => setRole(e.target.value)} required>
                  <option value="" disabled>اختر اللجنة المنظمة...</option>
                  {availableRoles.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex gap-2">
                <button type="submit" disabled={busy} className="btn btn-primary flex-1">{busy ? '...' : 'حفظ'}</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary px-6">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
