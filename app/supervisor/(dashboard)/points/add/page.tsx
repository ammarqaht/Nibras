'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = {
  id: number; membershipNo: number; studentName: string;
  groupId: number | null; registrationStatus: string;
  paymentStatus: string; stage: string; grade: string;
};
type Group = { id: number; name: string; stage: string };

const ADD_POINTS_ROLES = [
  'admin', 'cultural_supervisor', 'sports_supervisor',
  'scientific_supervisor', 'social_supervisor',
];
const GROUP_POINTS_ROLES = [
  'admin', 'cultural_supervisor', 'sports_supervisor',
  'scientific_supervisor', 'social_supervisor', 'stage_supervisor',
];

const STUDENT_CATEGORIES = [
  { key: 'participation', label: 'مشاركة' },
  { key: 'behavior',     label: 'سلوك'   },
  { key: 'store',        label: 'متجر'   },
  { key: 'other',        label: 'أخرى'   },
];

const GROUP_CATEGORIES = [
  { key: 'competition', label: 'مسابقة'  },
  { key: 'sports',      label: 'رياضي'   },
  { key: 'social',      label: 'اجتماعي' },
  { key: 'scientific',  label: 'علمي'    },
];

export default function AddPointsPage() {
  const { user } = useSupervisor();
  const roles = user?.role ? user.role.split(',').map(r => r.trim()) : [];
  const canAdd = roles.some(r => ADD_POINTS_ROLES.includes(r));
  const canAddGroupPoints = roles.some(r => GROUP_POINTS_ROLES.includes(r));

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const categories = mode === 'group' ? GROUP_CATEGORIES : STUDENT_CATEGORIES;

  // Multi-student selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Group selection
  const [groupId, setGroupId] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('5');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('behavior');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/supervisor/students?scope=all', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
    ]).then(async ([sr, gr]) => {
      const srj = await sr.json().catch(() => ({ students: [] }));
      const grj = await gr.json().catch(() => ({ groups: [] }));
      const allSt: Student[] = srj.students ?? [];
      setStudents(allSt.filter(s =>
        s.registrationStatus === 'approved' &&
        (s.paymentStatus === 'paid' || s.paymentStatus === 'exempted' || s.paymentStatus === '')
      ));
      setGroups(grj.groups ?? []);
      setLoading(false);
    });
  }, []);

  // Close student dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close group dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setIsGroupOpen(false);
        if (groupId) {
          const g = groups.find(g => String(g.id) === groupId);
          if (g) setGroupQuery(`${g.name} (${g.stage})`);
        } else {
          setGroupQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [groupId, groups]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      s.studentName.toLowerCase().includes(q) || String(s.membershipNo).includes(q)
    );
  }, [students, studentQuery]);

  const filteredGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) || g.stage?.toLowerCase().includes(q)
    );
  }, [groups, groupQuery]);

  const selectedStudents = useMemo(
    () => students.filter(s => selectedIds.includes(s.id)),
    [students, selectedIds]
  );

  function toggleStudent(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const delta = sign * Math.abs(parseInt(amount, 10) || 0);
    if (!delta || !reason.trim()) return pushToast('error', 'أدخل عدد النقاط والسبب');
    if (mode === 'individual' && selectedIds.length === 0)
      return pushToast('error', 'اختر طالباً واحداً على الأقل');
    if (mode === 'group' && !groupId)
      return pushToast('error', 'اختر المجموعة');

    setBusy(true);
    const r = await fetch('/api/supervisor/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationIds: mode === 'individual' ? selectedIds : undefined,
        groupId: mode === 'group' ? groupId : undefined,
        delta, reason: reason.trim(), category,
      }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل تسجيل النقاط');

    if (mode === 'group') {
      const grpName = groups.find(g => String(g.id) === groupId)?.name ?? 'المجموعة';
      pushToast('success', `تم رصد النقاط لأسرة "${grpName}"`);
    } else {
      pushToast('success', selectedIds.length > 1
        ? `تم رصد النقاط لـ ${selectedIds.length} طلاب`
        : 'تم رصد النقاط');
    }

    setReason('');
    setSelectedIds([]);
    setStudentQuery('');
    setGroupId('');
    setGroupQuery('');
  }

  if (!canAdd) {
    return (
      <div className="card p-10 text-center text-ink-500">
        🔒 عذراً، لا تملك الصلاحية لرصد النقاط.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/supervisor/points"
          className="text-ink-400 hover:text-ink-700 transition-colors p-1"
          title="العودة للوحة النقاط"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-0.5">رصد النقاط</h1>
          <p className="text-sm text-ink-500">امنح أو اخصم نقاطاً لطالب أو أكثر، أو لمجموعة كاملة.</p>
        </div>
      </div>

      <div className="max-w-lg">
        <form onSubmit={submit} className="card p-6 space-y-4">
          {/* Mode toggle */}
          {canAddGroupPoints && (
            <div className="flex gap-2">
              <button
                type="button"
                className={`choice flex-1 ${mode === 'individual' ? 'is-active' : ''}`}
                onClick={() => { setMode('individual'); setCategory(STUDENT_CATEGORIES[0].key); }}
              >
                طلاب
              </button>
              <button
                type="button"
                className={`choice flex-1 ${mode === 'group' ? 'is-active' : ''}`}
                onClick={() => { setMode('group'); setCategory(GROUP_CATEGORIES[0].key); }}
              >
                مجموعة
              </button>
            </div>
          )}

          {/* Student multi-select */}
          {mode === 'individual' ? (
            <div ref={searchRef}>
              <label className="label">
                الطلاب
                <span className="text-ink-400 font-normal text-xs mr-1">(يمكن اختيار أكثر من طالب)</span>
              </label>

              {selectedStudents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedStudents.map(s => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 bg-brand/10 text-brand-700 text-xs px-2.5 py-1 rounded-full font-medium"
                    >
                      {s.studentName}
                      <button
                        type="button"
                        onClick={() => toggleStudent(s.id)}
                        className="text-brand-400 hover:text-brand-700 flex items-center"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-ink-400 hover:text-red-500 px-1 transition-colors"
                  >
                    مسح الكل
                  </button>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  className="field w-full"
                  placeholder="ابحث عن طالب بالاسم أو رقم العضوية..."
                  value={studentQuery}
                  onChange={e => { setStudentQuery(e.target.value); setIsDropdownOpen(true); }}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                {isDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg max-h-64 overflow-y-auto scroll-soft">
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-sm text-ink-400 text-center">لا يوجد طلاب</div>
                    ) : (
                      filteredStudents.map(s => {
                        const sel = selectedIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleStudent(s.id)}
                            className={`w-full text-right px-3 py-2 text-sm hover:bg-cream-50 transition-colors flex items-center gap-2.5 border-b border-ink-50 last:border-0 ${sel ? 'bg-brand/5' : ''}`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-brand border-brand' : 'border-ink-300'}`}>
                              {sel && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              )}
                            </div>
                            <span className={`flex-1 font-medium ${sel ? 'text-brand-700' : 'text-ink-900'}`}>
                              {s.studentName}
                            </span>
                            <div className="text-xs text-ink-400 shrink-0">
                              <span className="font-mono">#{s.membershipNo}</span>
                              <span className="mx-1">·</span>
                              <span>{s.stage}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Group select */
            <div ref={groupRef} className="relative">
              <label className="label">المجموعة / الأسرة</label>
              <div className="relative">
                <input
                  type="text"
                  className="field w-full"
                  placeholder="ابحث عن مجموعة..."
                  value={groupQuery}
                  onChange={e => {
                    setGroupQuery(e.target.value);
                    setIsGroupOpen(true);
                    if (!e.target.value) setGroupId('');
                  }}
                  onFocus={() => setIsGroupOpen(true)}
                />
                {groupId && (
                  <button
                    type="button"
                    onClick={() => { setGroupId(''); setGroupQuery(''); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {isGroupOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg max-h-60 overflow-y-auto scroll-soft">
                  {filteredGroups.length === 0 ? (
                    <div className="p-3 text-sm text-ink-400 text-center">لا توجد مجموعات</div>
                  ) : (
                    filteredGroups.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { setGroupId(String(g.id)); setGroupQuery(`${g.name} (${g.stage})`); setIsGroupOpen(false); }}
                        className={`w-full text-right px-3 py-2 text-sm hover:bg-cream-50 transition-colors flex items-center justify-between border-b border-ink-50 last:border-0 ${groupId === String(g.id) ? 'bg-brand/5 text-brand-700 font-semibold' : 'text-ink-900'}`}
                      >
                        <span className="font-semibold">{g.name}</span>
                        <span className="text-xs text-ink-400">{g.stage}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sign */}
          <div>
            <label className="label">النوع</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`choice choice-add flex-1 ${sign === 1 ? 'is-active font-bold' : 'text-green-600 border-green-200 bg-white hover:bg-green-50'}`}
                onClick={() => setSign(1)}
              >
                + إضافة
              </button>
              <button
                type="button"
                className={`choice choice-deduct flex-1 ${sign === -1 ? 'is-active font-bold' : 'text-red-600 border-red-200 bg-white hover:bg-red-50'}`}
                onClick={() => setSign(-1)}
              >
                − خصم
              </button>
            </div>
          </div>

          {/* Amount + category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">عدد النقاط</label>
              <input
                className="field"
                dir="ltr"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <select className="field" value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="label">السبب</label>
            <input
              className="field"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="مثال: تميّز في النشاط"
            />
          </div>

          {sign === -1 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
              {category === 'store' ? (
                <p>🛒 **خصم متجر**: سيتم خصم النقاط من **الرصيد القابل للشراء** فقط. لن يتأثر إجمالي نقاط الطالب أو ترتيبه في لوحة الصدارة.</p>
              ) : (
                <p>⚠️ **خصم نهائي (عقوبة)**: سيتم خصم النقاط من **الرصيد والإجمالي** معاً، مما يقلل ترتيب الطالب في لوحة الصدارة.</p>
              )}
            </div>
          )}

          <button type="submit" disabled={busy || loading} className="btn btn-primary w-full">
            {busy ? '...' : mode === 'individual' && selectedIds.length > 1
              ? `رصد النقاط لـ ${selectedIds.length} طلاب`
              : 'رصد النقاط'}
          </button>
        </form>
      </div>
    </div>
  );
}
