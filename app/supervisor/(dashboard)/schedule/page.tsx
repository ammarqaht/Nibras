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
  stage?: string;
  notes?: string | null;
  createdAt: string;
};

const ROLES = [
  { key: 'social_supervisor', label: 'اللجنة الاجتماعية', color: 'bg-red-100 text-red-800 border-red-200' },
  { key: 'cultural_supervisor', label: 'اللجنة الثقافية', color: 'bg-green-100 text-green-800 border-green-200' },
  { key: 'media_supervisor', label: 'اللجنة الإعلامية', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { key: 'groups_supervisor', label: 'لجنة الأسر', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'attendance_supervisor', label: 'لجنة التحضير', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { key: 'general_supervisor', label: 'الإدارة', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  { key: 'scientific_supervisor', label: 'اللجنة العلمية', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { key: 'sports_supervisor', label: 'اللجنة الرياضية', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { key: 'administrative_supervisor', label: 'اللجنة الإدارية', color: 'bg-teal-100 text-teal-800 border-teal-200' }
];

const DEFAULT_SLOTS = [
  { label: 'الفقرة الأولى (04:30 م - 05:30 م)', start: '16:30', end: '17:30' },
  { label: 'الفقرة الثانية (05:30 م - 06:30 م)', start: '17:30', end: '18:30' },
  { label: 'الفقرة الثالثة (07:30 م - 08:45 م)', start: '19:30', end: '20:45' }
];

const STAGES_LIST = ['ابتدائي', 'متوسط', 'ثانوي'];

function getRoleStyle(role: string) {
  return ROLES.find(r => r.key === role)?.color || 'bg-gray-100 text-gray-800 border-gray-200';
}
function getRoleLabel(role: string) {
  return ROLES.find(r => r.key === role)?.label || 'غير محدد';
}

function getProgramSlots(s: ScheduleInfo): number[] {
  const slots: number[] = [];
  if (s.startTime < '17:30' && s.endTime > '16:30') slots.push(0);
  if (s.startTime < '18:30' && s.endTime > '17:30') slots.push(1);
  if (s.startTime < '20:45' && s.endTime > '19:30') slots.push(2);
  return slots;
}

// Only these committees can add/edit programs
const COMMITTEE_ROLES = ['social_supervisor','cultural_supervisor','scientific_supervisor','sports_supervisor'];

export default function SchedulePage() {
  const { user } = useSupervisor();
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Daily View Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  });

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [role, setRole] = useState('');
  const [programStages, setProgramStages] = useState<string[]>(['الكل']);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [notes, setNotes] = useState('');

  // Details Modal States
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedDetailsSchedule, setSelectedDetailsSchedule] = useState<ScheduleInfo | null>(null);

  function openDetailsModal(s: ScheduleInfo) {
    setSelectedDetailsSchedule(s);
    setIsDetailsOpen(true);
  }

  const perms = useMemo(() => user?.permissions || [], [user]);
  const hasPerm = (p: string) => perms.includes('*') || perms.includes(p);

  const userRoles = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return ROLES.map(r => r.key);
    return user.role.split(',').map(r => r.trim());
  }, [user]);

  const isAdmin = userRoles.includes('admin');
  const isAdministrative = userRoles.includes('administrative_supervisor');
  // Admins and administrative supervisors can manage all schedules; committee supervisors manage their own
  const canManageSchedule = isAdmin || isAdministrative || userRoles.some(r => COMMITTEE_ROLES.includes(r));
  const availableRoles = (isAdmin || isAdministrative)
    ? ROLES.filter(r => COMMITTEE_ROLES.includes(r.key))
    : ROLES.filter(r => userRoles.includes(r.key) && COMMITTEE_ROLES.includes(r.key));

  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayIndex = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // In our system, the week starts on Sunday (dayIndex = 0).
    const sunday = new Date(dateObj);
    sunday.setDate(dateObj.getDate() - dayIndex);
    
    const days: { dateStr: string; label: string; dateLabel: string }[] = [];
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    
    for (let i = 0; i < 5; i++) {
      const current = new Date(sunday);
      current.setDate(sunday.getDate() + i);
      const tzOffset = current.getTimezoneOffset() * 60000;
      const dateStr = new Date(current.getTime() - tzOffset).toISOString().slice(0, 10);
      days.push({
        dateStr,
        label: dayNames[i],
        dateLabel: new Intl.DateTimeFormat('ar-SA', { month: 'short', day: 'numeric' }).format(current)
      });
    }
    return days;
  }, [selectedDate]);

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

  useEffect(() => {
    load();
  }, []);

  function navigateWeek(offset: number) {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + (offset * 7));
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    const localISO = new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 10);
    setSelectedDate(localISO);
  }

  function openAddModal(selectedDateParam?: string) {
    setEditingScheduleId(null);
    setTitle('');
    setDate(selectedDateParam || selectedDate);
    setRole(availableRoles.length > 0 ? availableRoles[0].key : '');
    setProgramStages(['الكل']);
    setSelectedSlots([0]); // Default first slot checked
    setNotes('');
    setIsModalOpen(true);
  }

  function openEditModal(s: ScheduleInfo) {
    setEditingScheduleId(s.id);
    setTitle(s.title);
    setDate(s.date);
    setRole(s.role);
    setNotes(s.notes || '');
    
    // Reconstruct selected slots
    setSelectedSlots(getProgramSlots(s));

    const stagesList = (s.stage || 'الكل').split(',').map(x => x.trim());
    setProgramStages(stagesList);
    setIsModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !role || programStages.length === 0 || selectedSlots.length === 0) {
      return pushToast('error', 'يرجى إكمال جميع الحقول واختيار فقرة ومرحلة واحدة على الأقل');
    }
    
    setBusy(true);
    const minSlot = Math.min(...selectedSlots);
    const maxSlot = Math.max(...selectedSlots);
    const startTimeVal = DEFAULT_SLOTS[minSlot].start;
    const endTimeVal = DEFAULT_SLOTS[maxSlot].end;
    const stageStr = programStages.join(',');
    
    const url = '/api/supervisor/schedule';
    const method = editingScheduleId ? 'PUT' : 'POST';
    const payload = editingScheduleId 
      ? { id: editingScheduleId, title, date, startTime: startTimeVal, endTime: endTimeVal, role, stage: stageStr, notes }
      : { title, date, startTime: startTimeVal, endTime: endTimeVal, role, stage: stageStr, notes };

    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return pushToast('error', j.error ?? 'فشل حفظ البرنامج');
    }
    pushToast('success', editingScheduleId ? 'تم تعديل البرنامج' : 'تمت إضافة البرنامج للجدول');
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

  const formatDateLabelWithoutDay = (dStr: string) => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('ar-SA', { month: 'short', day: 'numeric' }).format(dateObj);
  };

  const formatDateLabelWithDay = (dStr: string) => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('ar-SA', { weekday: 'long', month: 'short', day: 'numeric' }).format(dateObj);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">الجدول الأسبوعي</h1>
          <p className="text-sm text-ink-500">تنظيم وتوزيع البرامج والأنشطة الأسبوعية بحسب الفقرات والمراحل الدراسية.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-3 self-start md:self-auto">
          {/* Week Navigation */}
          <div className="flex bg-white rounded-lg border border-ink-200 overflow-hidden shadow-sm items-center">
            <button onClick={() => navigateWeek(-1)} className="px-2 py-1.5 md:px-3 md:py-2 hover:bg-cream-100 text-ink-600 font-bold border-l border-ink-200 cursor-pointer" title="الأسبوع السابق">
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <span className="px-2 py-1 text-xs md:px-4 md:py-1.5 md:text-sm font-semibold text-ink-900 select-none min-w-[130px] md:min-w-[200px] text-center">
              {weekDays.length > 0 ? `${formatDateLabelWithoutDay(weekDays[0].dateStr)} - ${formatDateLabelWithoutDay(weekDays[4].dateStr)}` : ''}
            </span>
            <button onClick={() => navigateWeek(1)} className="px-2 py-1.5 md:px-3 md:py-2 hover:bg-cream-100 text-ink-600 font-bold border-r border-ink-200 cursor-pointer" title="الأسبوع التالي">
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
          
          <input 
            type="date" 
            value={selectedDate} 
            onChange={e => {
              if (e.target.value) setSelectedDate(e.target.value);
            }} 
            className="field py-1 px-2 text-xs w-28 md:py-2 md:px-2.5 md:w-36"
            title="اختر تاريخاً محدداً"
          />
          
          {availableRoles.length > 0 && (
            <button onClick={() => openAddModal()} className="btn btn-primary py-1 px-3 text-xs md:text-sm md:py-2 md:px-4 whitespace-nowrap">
              + إضافة برنامج
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-ink-400">جارٍ تحميل الجدول...</div>
      ) : (
        <div className="space-y-6 md:space-y-8">
          {weekDays.map(day => {
            const daySchedules = schedules.filter(s => s.date === day.dateStr);

            return (
              <div key={day.dateStr} className="border border-ink-200 rounded-xl shadow-soft bg-white p-3.5 md:p-5">
                <div className="flex items-center justify-between mb-3 border-b border-ink-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm md:text-lg font-bold text-brand-600 bg-brand-50 px-2.5 py-0.5 md:px-3.5 md:py-1 rounded-lg md:rounded-xl border border-brand-100">
                      {day.label}
                    </span>
                    <span className="text-xs md:text-sm font-semibold text-ink-500">
                      {day.dateLabel}
                    </span>
                  </div>
                  
                  {canManageSchedule && availableRoles.length > 0 && (
                    <button 
                      onClick={() => openAddModal(day.dateStr)} 
                      className="btn btn-secondary py-1 px-2 md:py-1.5 md:px-3 text-[10px] md:text-xs flex items-center gap-1 hover:bg-cream-100/80 border border-ink-200 shadow-sm font-semibold rounded-lg cursor-pointer"
                    >
                      <svg className="w-3 h-3 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span className="hidden sm:inline">+ إضافة برنامج لليوم</span>
                      <span className="sm:hidden">إضافة</span>
                    </button>
                  )}
                </div>
                
                <div className="overflow-x-auto scroll-soft rounded-lg border border-ink-100">
                  <table className="w-full border-collapse text-right min-w-[560px] table-fixed">
                    <thead>
                      <tr className="bg-cream-50/50 border-b border-ink-200">
                        <th className="w-[60px] md:w-[72px] p-1.5 md:p-2 text-ink-700 font-bold border-l border-ink-200 text-center text-[9px] md:text-[11px]">المرحلة</th>
                        <th className="p-2 md:p-3 text-ink-900 font-bold border-l border-ink-200 text-center text-xs md:text-sm">الفقرة الأولى<br/><span className="text-[9px] md:text-[11px] font-normal text-ink-500">04:30 م - 05:30 م</span></th>
                        <th className="p-2 md:p-3 text-ink-900 font-bold border-l border-ink-200 text-center text-xs md:text-sm">الفقرة الثانية<br/><span className="text-[9px] md:text-[11px] font-normal text-ink-500">05:30 م - 06:30 م</span></th>
                        <th className="p-2 md:p-3 text-ink-900 font-bold text-center text-xs md:text-sm">الفقرة الثالثة<br/><span className="text-[9px] md:text-[11px] font-normal text-ink-500">07:30 م - 08:45 م</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'ابتدائي', label: 'ابتدائي', color: '#12B3D5' },
                        { key: 'متوسط', label: 'متوسط', color: '#103F91' },
                        { key: 'ثانوي', label: 'ثانوي', color: '#E52E25' },
                      ].map(({ key, label, color }) => {
                        const rowPrograms = daySchedules.filter(s => {
                          const stageList = (s.stage || 'الكل').split(',').map((x: string) => x.trim());
                          return stageList.includes('الكل') || stageList.includes(key);
                        });
                        return (
                          <tr key={key} className="border-b border-ink-100 last:border-0">
                            <td className="border-l border-ink-100 p-1 align-middle">
                              <div className="flex items-center justify-center min-h-[50px]">
                                <span className="text-[8px] md:text-[10px] font-bold writing-mode-vertical text-center leading-tight" style={{ color }}>{label}</span>
                              </div>
                            </td>
                            <td colSpan={3} className="p-1 md:p-2 align-top">
                              <div className="grid grid-cols-3 gap-2 md:gap-2.5 relative min-h-[55px] md:min-h-[65px] w-full">
                                <div className="absolute inset-0 grid grid-cols-3 pointer-events-none z-0">
                                  <div className="border-l border-dashed border-ink-200/30 h-full"></div>
                                  <div className="border-l border-dashed border-ink-200/30 h-full"></div>
                                  <div className="h-full"></div>
                                </div>
                                {rowPrograms.length > 0 ? (
                                  rowPrograms.map(s => {
                                    const canEdit = canManageSchedule && (user?.role === 'admin' || userRoles.includes(s.role));
                                    const programSlots = getProgramSlots(s);
                                    const startCol = programSlots.length > 0 ? (Math.min(...programSlots) + 1) : 1;
                                    const spanWidth = programSlots.length > 0 ? (Math.max(...programSlots) - Math.min(...programSlots) + 1) : 3;
                                    return (
                                      <div
                                        key={s.id}
                                        onClick={() => openDetailsModal(s)}
                                        className={`p-1.5 md:p-2 rounded-lg border text-[10px] md:text-xs relative z-10 group ${getRoleStyle(s.role)} shadow-sm flex flex-col justify-between cursor-pointer`}
                                        style={{ gridColumn: `${startCol} / span ${spanWidth}` }}
                                      >
                                        {canEdit && (
                                          <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); openEditModal(s); }} className="text-brand-600 hover:text-brand-800 bg-white/95 border border-ink-200 rounded p-0.5 shadow-sm cursor-pointer" title="تعديل">
                                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); removeSchedule(s.id); }} className="text-nred-600 hover:text-nred-800 bg-white/95 border border-ink-200 rounded p-0.5 shadow-sm cursor-pointer" title="حذف">
                                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                            </button>
                                          </div>
                                        )}
                                        <div>
                                          <div className="font-bold pe-8 text-ink-900 break-words line-clamp-2 text-[11px] md:text-xs" title={s.title}>{s.title}</div>
                                          <div className="text-[8px] md:text-[9px] font-semibold opacity-85 mt-0.5">{getRoleLabel(s.role)}</div>
                                        </div>
                                        {s.notes ? (
                                          <div className="text-[9px] md:text-[10px] text-ink-600 mt-1 bg-white/50 px-1.5 py-0.5 rounded border border-black/5 italic flex items-center justify-between gap-1 overflow-hidden">
                                            <span className="truncate flex-1 text-right" title={s.notes}>{s.notes.split('\n')[0]}</span>
                                            <button onClick={(e) => { e.stopPropagation(); openDetailsModal(s); }} className="text-brand-700 hover:text-brand-900 hover:underline font-bold text-[8px] md:text-[9px] whitespace-nowrap shrink-0 cursor-pointer">التفاصيل</button>
                                          </div>
                                        ) : (
                                          <div className="flex justify-end mt-1">
                                            <button onClick={(e) => { e.stopPropagation(); openDetailsModal(s); }} className="text-brand-700 hover:text-brand-900 hover:underline font-bold text-[8px] md:text-[9px] cursor-pointer">التفاصيل</button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="col-span-3 flex items-center justify-center text-[9px] text-ink-200 py-3 select-none z-10">—</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة الإضافة / التعديل */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden pop-in max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-ink-200 flex justify-between items-center bg-ink-50 shrink-0">
              <h3 className="text-lg font-bold text-ink-900">
                {editingScheduleId ? 'تعديل البرنامج' : 'إضافة برنامج للجدول'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-400 hover:text-ink-900 p-1.5 rounded-lg hover:bg-ink-100 transition-colors cursor-pointer" aria-label="إغلاق">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto scroll-soft flex-1">
              <div>
                <label className="label">اسم البرنامج</label>
                <input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: دوري البلايستيشن" required />
              </div>
              <div>
                <label className="label">التاريخ</label>
                <input type="date" className="field" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="label">المرحلة :</label>
                  <div className="flex flex-wrap gap-2.5 p-3 bg-cream-100/50 rounded-xl border border-ink-200">
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm font-semibold select-none">
                      <input 
                        type="checkbox" 
                        className="accent-brand"
                        checked={programStages.includes('الكل')} 
                        onChange={e => {
                          if (e.target.checked) {
                            setProgramStages(['الكل']);
                          } else {
                            setProgramStages([]);
                          }
                        }} 
                      />
                      الكل (مشترك)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm font-semibold select-none">
                      <input 
                        type="checkbox" 
                        className="accent-brand"
                        disabled={programStages.includes('الكل')}
                        checked={programStages.includes('ابتدائي') || programStages.includes('الكل')} 
                        onChange={e => {
                          if (e.target.checked) {
                            setProgramStages([...programStages.filter(x => x !== 'الكل'), 'ابتدائي']);
                          } else {
                            setProgramStages(programStages.filter(s => s !== 'ابتدائي'));
                          }
                        }} 
                      />
                      ابتدائي
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm font-semibold select-none">
                      <input 
                        type="checkbox" 
                        className="accent-brand"
                        disabled={programStages.includes('الكل')}
                        checked={programStages.includes('متوسط') || programStages.includes('الكل')} 
                        onChange={e => {
                          if (e.target.checked) {
                            setProgramStages([...programStages.filter(x => x !== 'الكل'), 'متوسط']);
                          } else {
                            setProgramStages(programStages.filter(s => s !== 'متوسط'));
                          }
                        }} 
                      />
                      متوسط
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm font-semibold select-none">
                      <input 
                        type="checkbox" 
                        className="accent-brand"
                        disabled={programStages.includes('الكل')}
                        checked={programStages.includes('ثانوي') || programStages.includes('الكل')} 
                        onChange={e => {
                          if (e.target.checked) {
                            setProgramStages([...programStages.filter(x => x !== 'الكل'), 'ثانوي']);
                          } else {
                            setProgramStages(programStages.filter(s => s !== 'ثانوي'));
                          }
                        }} 
                      />
                      ثانوي
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="label">الأوقات / الفقرات</label>
                  <div className="flex flex-col gap-2.5 p-3 bg-cream-100/50 rounded-xl border border-ink-200">
                    {DEFAULT_SLOTS.map((slot, idx) => (
                      <label key={idx} className="flex items-center gap-2 cursor-pointer text-sm font-semibold select-none">
                        <input 
                          type="checkbox"
                          className="accent-brand"
                          checked={selectedSlots.includes(idx)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedSlots([...selectedSlots, idx]);
                            } else {
                              setSelectedSlots(selectedSlots.filter(i => i !== idx));
                            }
                          }}
                        />
                        {slot.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="label">ملاحظات (اختياري)</label>
                <textarea 
                  className="field min-h-[80px]" 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="اكتب أي ملاحظات للبرنامج هنا..."
                />
              </div>
              
              {availableRoles.length > 1 ? (
                <div>
                  <label className="label">اللجنة / الدور <span className="text-xs text-ink-400 font-normal">(الأدوار المتاحة لك فقط)</span></label>
                  <select className="field" value={role} onChange={e => setRole(e.target.value)} required>
                    <option value="" disabled>اختر اللجنة المنظمة...</option>
                    {availableRoles.map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </div>
              ) : availableRoles.length === 1 ? (
                <div>
                  <span className="text-xs font-semibold text-ink-400 block mb-1">اللجنة المنظمة</span>
                  <div className="bg-ink-50 p-3 rounded-lg border border-ink-100 text-sm font-bold text-ink-800">
                    {availableRoles[0].label}
                  </div>
                </div>
              ) : null}
              
              <div className="pt-2 flex gap-2">
                <button type="submit" disabled={busy} className="btn btn-primary flex-1">
                  {busy ? '...' : editingScheduleId ? 'حفظ التعديلات' : 'حفظ'}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary px-6">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة عرض تفاصيل البرنامج */}
      {isDetailsOpen && selectedDetailsSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDetailsOpen(false)}>
          <div 
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden pop-in border border-ink-200 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-ink-200 flex justify-between items-center bg-ink-50 shrink-0">
              <h3 className="text-lg font-bold text-ink-900">تفاصيل البرنامج</h3>
              <button 
                onClick={() => setIsDetailsOpen(false)} 
                className="text-ink-400 hover:text-ink-900 p-1.5 rounded-lg hover:bg-ink-100 transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-right overflow-y-auto scroll-soft flex-1">
              <div>
                <span className="text-xs font-semibold text-ink-400 block mb-0.5">اسم البرنامج</span>
                <div className="text-base font-bold text-ink-900 bg-cream-50 p-3 rounded-lg border border-ink-100">
                  {selectedDetailsSchedule.title}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-semibold text-ink-400 block mb-0.5">اللجنة المنظمة</span>
                  <div className={`text-xs font-bold p-2.5 rounded-lg border text-center ${getRoleStyle(selectedDetailsSchedule.role)}`}>
                    {getRoleLabel(selectedDetailsSchedule.role)}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-ink-400 block mb-0.5">المرحلة المستهدفة</span>
                  <div className="text-xs font-bold p-2.5 rounded-lg border border-ink-200 bg-ink-50 text-center text-ink-800">
                    {selectedDetailsSchedule.stage || 'الكل'}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-ink-400 block mb-0.5">اليوم والتاريخ</span>
                <div className="text-xs font-semibold text-ink-800 bg-ink-50 p-2.5 rounded-lg border border-ink-100">
                  {formatDateLabelWithDay(selectedDetailsSchedule.date)}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-ink-400 block mb-0.5">الفقرات الزمنية</span>
                <div className="text-xs font-semibold text-ink-800 bg-ink-50 p-2.5 rounded-lg border border-ink-100 space-y-1">
                  {getProgramSlots(selectedDetailsSchedule).map(slotIdx => (
                    <div key={slotIdx} className="flex items-center gap-1.5 justify-end text-sm">
                      <span>{DEFAULT_SLOTS[slotIdx].label}</span>
                      <span className="text-brand-500 font-bold">•</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedDetailsSchedule.notes && (
                <div>
                  <span className="text-xs font-semibold text-ink-400 block mb-0.5">ملاحظات البرنامج</span>
                  <div className="text-xs text-ink-700 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 italic whitespace-pre-wrap break-words">
                    {selectedDetailsSchedule.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-ink-50 border-t border-ink-200 flex gap-2 shrink-0">
              {selectedDetailsSchedule && canManageSchedule && (isAdmin || userRoles.includes(selectedDetailsSchedule.role)) && (
                <button
                  onClick={() => { setIsDetailsOpen(false); openEditModal(selectedDetailsSchedule); }}
                  className="btn btn-primary flex-1 text-sm font-bold flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  تعديل البرنامج
                </button>
              )}
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="btn btn-secondary px-6 flex-1 text-sm font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
