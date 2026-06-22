'use client';

import { useEffect, useMemo, useState } from 'react';
import { pushToast } from '@/components/Toast';

type Student = { id: number; membershipNo: number; studentName: string; stage: string; grade: string; groupId: number | null; registrationStatus: string; paymentStatus: string };
type Group = { id: number; name: string };
type Rec = { registrationId: number; date: string; status: string };

const STATUSES = [
  { key: 'present', label: 'حاضر', cls: 'pill-green' },
  { key: 'late', label: 'متأخر', cls: 'pill-yellow' },
  { key: 'absent', label: 'غائب', cls: 'pill-red' }
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AttendancePage() {
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [records, setRecords] = useState<Record<number, string>>({});
  const [fGroup, setFGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [quick, setQuick] = useState('');

  async function loadStatic() {
    const [sr, gr] = await Promise.all([
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' })
    ]);
    const sj = await sr.json().catch(() => ({ students: [] }));
    const gj = await gr.json().catch(() => ({ groups: [] }));
    const allSt: Student[] = sj.students ?? [];
    setStudents(allSt.filter((s) => s.registrationStatus === 'approved' && s.paymentStatus === 'paid'));
    setGroups(gj.groups ?? []);
  }

  async function loadDay(d: string) {
    const r = await fetch(`/api/supervisor/attendance?date=${d}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({ attendance: [] }));
    const map: Record<number, string> = {};
    (j.attendance as Rec[]).forEach((rec) => { map[rec.registrationId] = rec.status; });
    setRecords(map);
    setLoading(false);
  }

  useEffect(() => { loadStatic(); }, []);
  useEffect(() => { setLoading(true); loadDay(date); }, [date]);

  async function mark(registrationId: number, status: string) {
    setRecords((prev) => ({ ...prev, [registrationId]: status })); // optimistic
    const r = await fetch('/api/supervisor/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId, date, status })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      pushToast('error', j.error ?? 'فشل تسجيل الحضور');
      loadDay(date);
    }
  }

  async function quickPresent(e: React.FormEvent) {
    e.preventDefault();
    const mNo = quick.trim();
    if (!mNo) return;
    const r = await fetch('/api/supervisor/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipNo: mNo, date, status: 'present' })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'لم يتم العثور على الطالب');
    pushToast('success', 'تم تسجيل الحضور');
    setQuick('');
    loadDay(date);
  }

  const list = useMemo(
    () => students.filter((s) => !fGroup || String(s.groupId) === fGroup),
    [students, fGroup]
  );

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0 };
    list.forEach((s) => {
      const st = records[s.id];
      if (st === 'present') c.present++;
      else if (st === 'late') c.late++;
      else if (st === 'absent') c.absent++;
    });
    return c;
  }, [list, records]);

  return (
    <div className="space-y-6 relative">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">تسجيل الحضور</h1>
        <p className="text-sm text-ink-500">اختر اليوم وسجّل حضور الطلاب.</p>
      </div>

      {/* Blur Overlay with "Coming Soon" */}
      <div className="absolute inset-x-0 bottom-0 top-[72px] bg-cream-50/40 backdrop-blur-[6px] z-10 flex items-center justify-center rounded-3xl min-h-[400px]">
        <div className="card p-8 sm:p-10 max-w-md text-center bg-white border border-ink-200 shadow-xl pop-in m-6">
          <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h2 className="font-display text-2xl text-ink-900 mb-2">قريباً</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            ميزة التحضير اليومي ومسح الـ QR والتحضير السريع قيد التطوير وستكون متاحة للمشرفين قريباً.
          </p>
        </div>
      </div>

      <div className="select-none pointer-events-none opacity-40 space-y-6">
        <div className="card p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label">التاريخ</label>
          <input type="date" className="field" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">المجموعة</label>
          <select className="field" value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
            <option value="">كل المجموعات</option>
            {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
          </select>
        </div>
        <form onSubmit={quickPresent}>
          <label className="label">تحضير سريع برقم العضوية</label>
          <div className="flex gap-2">
            <input className="field" dir="ltr" placeholder="1001" value={quick} onChange={(e) => setQuick(e.target.value)} />
            <button className="btn btn-primary px-4">حضور</button>
          </div>
        </form>
      </div>

      <div className="flex gap-2 mb-4 text-sm">
        <span className="pill pill-green">حاضر {counts.present}</span>
        <span className="pill pill-yellow">متأخر {counts.late}</span>
        <span className="pill pill-red">غائب {counts.absent}</span>
        <span className="pill pill-gray">بدون {list.length - counts.present - counts.late - counts.absent}</span>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</p>
        ) : list.length === 0 ? (
          <p className="text-center py-16 text-ink-400 text-sm">لا يوجد طلاب.</p>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto scroll-soft">
              <table className="tbl">
                <thead>
                  <tr><th>الطالب</th><th>العضوية</th><th>المرحلة</th><th>الحالة</th></tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.studentName}</td>
                      <td dir="ltr" className="text-right font-mono text-ink-500">#{s.membershipNo}</td>
                      <td className="text-ink-500 text-sm">{s.stage} — {s.grade}</td>
                      <td>
                        <div className="flex gap-1.5">
                          {STATUSES.map((st) => {
                            const active = records[s.id] === st.key;
                            return (
                              <button
                                key={st.key}
                                onClick={() => mark(s.id, st.key)}
                                className={`choice py-1 px-3 text-xs ${active ? 'is-active' : ''}`}
                              >
                                {st.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="lg:hidden divide-y divide-ink-200">
              {list.map((s) => (
                <li key={s.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-2 mb-2.5">
                    <span className="font-semibold text-ink-900 truncate">{s.studentName}</span>
                    <span dir="ltr" className="font-mono text-xs text-ink-400 shrink-0">#{s.membershipNo}</span>
                  </div>
                  <div className="text-xs text-ink-400 mb-2.5">{s.stage} — {s.grade}</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {STATUSES.map((st) => {
                      const active = records[s.id] === st.key;
                      return (
                        <button
                          key={st.key}
                          onClick={() => mark(s.id, st.key)}
                          className={`choice py-2 text-xs ${active ? 'is-active' : ''}`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
