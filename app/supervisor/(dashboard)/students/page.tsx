'use client';

import { useEffect, useMemo, useState } from 'react';
import { stages } from '@/content';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  nationalId: string;
  guardianPhone: string;
  studentPhone: string | null;
  stage: string;
  grade: string;
  neighborhood: string;
  locationLat: number | null;
  locationLng: number | null;
  mapLink: string | null;
  hasCondition: boolean;
  conditionNote: string | null;
  createdAt: string;
  paymentStatus: string;
  paymentType: string;
  paymentReceipt: string | null;
  registrationStatus: string;
  groupId: number | null;
};

type Group = { id: number; name: string; stage: string };

function paymentPill(s: Student) {
  if (s.paymentStatus === 'paid') return { cls: 'pill-green', label: 'مدفوع' };
  if (s.paymentType === 'now' && s.paymentReceipt) return { cls: 'pill-yellow', label: 'بانتظار المراجعة 📑' };
  return { cls: 'pill-red', label: 'لم يدفع' };
}
function regPill(status: string) {
  if (status === 'approved') return { cls: 'pill-green', label: 'مقبول' };
  if (status === 'rejected') return { cls: 'pill-red', label: 'مرفوض' };
  return { cls: 'pill-yellow', label: 'قيد المراجعة' };
}

function StageMultiSelectDropdown({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleGrade = (grade: string, stageKey: string) => {
    const gradeKey = `grade:${grade}`;
    let nextSelected = selected.includes(gradeKey)
      ? selected.filter((k) => k !== gradeKey)
      : [...selected, gradeKey];

    const stageInfo = stages.find((st) => st.key === stageKey);
    if (stageInfo) {
      const allGradesKeys = stageInfo.grades.map((g) => `grade:${g}`);
      const hasAllGrades = allGradesKeys.every((gk) => nextSelected.includes(gk));
      if (hasAllGrades) {
        if (!nextSelected.includes(`stage:${stageKey}`)) {
          nextSelected.push(`stage:${stageKey}`);
        }
      } else {
        nextSelected = nextSelected.filter((k) => k !== `stage:${stageKey}`);
      }
    }
    onChange(nextSelected);
  };

  const toggleStage = (stageKey: string) => {
    const stageKeyStr = `stage:${stageKey}`;
    const stageInfo = stages.find((st) => st.key === stageKey);
    if (!stageInfo) return;

    const allGradesKeys = stageInfo.grades.map((g) => `grade:${g}`);
    const isStageSelected = selected.includes(stageKeyStr);

    let nextSelected = selected;
    if (isStageSelected) {
      nextSelected = nextSelected.filter((k) => k !== stageKeyStr && !allGradesKeys.includes(k));
    } else {
      const toAdd = [stageKeyStr, ...allGradesKeys].filter((k) => !nextSelected.includes(k));
      nextSelected = [...nextSelected, ...toAdd];
    }
    onChange(nextSelected);
  };

  const selectedGradesCount = selected.filter((k) => k.startsWith('grade:')).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="field flex items-center justify-between gap-2 text-right w-full bg-white select-none"
      >
        <span>
          {selectedGradesCount > 0
            ? `المراحل (${selectedGradesCount})`
            : 'تصفية المراحل'}
        </span>
        <span className="text-ink-400 text-xs">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-full min-w-[240px] max-h-80 overflow-y-auto bg-white border border-ink-200 rounded-xl shadow-xl z-50 p-3 space-y-3 scroll-soft text-right" dir="rtl">
            {stages.map((stage) => {
              const stageKeyStr = `stage:${stage.key}`;
              const isStageChecked = selected.includes(stageKeyStr);
              
              return (
                <div key={stage.key} className="space-y-1">
                  <label className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-cream-50 cursor-pointer text-sm font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={isStageChecked}
                      onChange={() => toggleStage(stage.key)}
                      className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                    <span className="text-ink-900">{stage.label}</span>
                  </label>

                  <div className="mr-6 space-y-1 border-r border-ink-100 pr-2">
                    {stage.grades.map((grade) => {
                      const gradeKeyStr = `grade:${grade}`;
                      const isGradeChecked = selected.includes(gradeKeyStr);
                      return (
                        <label
                          key={grade}
                          className="flex items-center gap-2 px-1.5 py-0.5 rounded-lg hover:bg-cream-50 cursor-pointer text-xs select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isGradeChecked}
                            onChange={() => toggleGrade(grade, stage.key)}
                            className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                          />
                          <span className="text-ink-700">{grade}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((s) => s !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="field flex items-center justify-between gap-2 text-right w-full bg-white select-none"
      >
        <span>{selected.length > 0 ? `${label} (${selected.length})` : label}</span>
        <span className="text-ink-400 text-xs">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-full min-w-[200px] max-h-60 overflow-y-auto bg-white border border-ink-200 rounded-xl shadow-xl z-50 p-2 space-y-0.5 scroll-soft">
            {options.length === 0 ? (
              <p className="text-center py-4 text-ink-400 text-xs">لا توجد خيارات</p>
            ) : (
              options.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-cream-50 cursor-pointer text-sm select-none"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span className="text-ink-800">{opt.label}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function StudentsPage() {
  const { user } = useSupervisor();
  const isAdmin = user?.role === 'admin';

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);

  // filters
  const [search, setSearch] = useState('');
  const [fStages, setFStages] = useState<string[]>([]);
  const [fGroups, setFGroups] = useState<string[]>([]);
  const [fNeighborhoods, setFNeighborhoods] = useState<string[]>([]);

  const [visibleCols, setVisibleCols] = useState({
    index: true,
    studentName: true,
    guardianPhone: true,
    membershipNo: true,
    stage: true,
    group: true,
    nationalId: false,
    studentPhone: false,
    neighborhood: false,
    paymentStatus: false,
    hasCondition: false,
  });
  const [showColSettings, setShowColSettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('nibras_student_cols');
    if (saved) {
      try {
        setVisibleCols(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const setVisibleCol = (key: keyof typeof visibleCols, val: boolean) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: val };
      localStorage.setItem('nibras_student_cols', JSON.stringify(next));
      return next;
    });
  };

  async function load() {
    const [sr, gr] = await Promise.all([
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' })
    ]);
    const sj = await sr.json().catch(() => ({ students: [] }));
    const gj = await gr.json().catch(() => ({ groups: [] }));
    setStudents(sj.students ?? []);
    setGroups(gj.groups ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const approvedStudents = useMemo(() => {
    return students.filter((s) => s.registrationStatus === 'approved' && s.paymentStatus === 'paid');
  }, [students]);

  const neighborhoods = useMemo(() => {
    const list = approvedStudents.map((s) => s.neighborhood?.trim()).filter(Boolean);
    return Array.from(new Set(list));
  }, [approvedStudents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approvedStudents.filter((s) => {
      if (q) {
        const hit =
          s.studentName.toLowerCase().includes(q) ||
          s.nationalId.includes(q) ||
          s.guardianPhone.includes(q) ||
          (s.studentPhone ?? '').includes(q) ||
          String(s.membershipNo).includes(q);
        if (!hit) return false;
      }
      if (fStages.length > 0) {
        const hasStageMatch = fStages.includes(`stage:${s.stage}`);
        const hasGradeMatch = fStages.includes(`grade:${s.grade}`);
        if (!hasStageMatch && !hasGradeMatch) return false;
      }
      if (fGroups.length > 0 && !fGroups.includes(String(s.groupId))) return false;
      if (fNeighborhoods.length > 0 && !fNeighborhoods.includes(s.neighborhood)) return false;
      return true;
    });
  }, [approvedStudents, search, fStages, fGroups, fNeighborhoods]);

  // optimistic local update after a PUT
  function applyUpdate(updated: Student) {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
  }

  function exportCsv() {
    const headers = [
      'رقم العضوية', 'اسم الطالب', 'رقم الهوية', 'جوال ولي الأمر', 'جوال الطالب',
      'المرحلة', 'الصف', 'الحي', 'حالة الدفع', 'نوع الدفع', 'حالة التسجيل', 'حالة صحية'
    ];
    const esc = (v: unknown) => {
      const str = String(v ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const rows = filtered.map((s) => [
      s.membershipNo, s.studentName, s.nationalId, s.guardianPhone, s.studentPhone ?? '',
      s.stage, s.grade, s.neighborhood,
      s.paymentStatus === 'paid' ? 'مدفوع' : 'غير مدفوع',
      s.paymentType === 'now' ? 'فوري' : 'آجل',
      s.registrationStatus === 'approved' ? 'مقبول' : s.registrationStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة',
      s.hasCondition ? 'نعم' : 'لا'
    ]);
    const csv = '﻿' + [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nibras-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">سجل الطلاب</h1>
          <p className="text-sm text-ink-500">{filtered.length} طالب من أصل {approvedStudents.length}</p>
        </div>
        <div className="flex gap-2 items-center relative">
          <button
            onClick={() => setShowColSettings(!showColSettings)}
            className="btn btn-secondary text-sm flex items-center gap-1.5"
          >
            ⚙️ تخصيص الأعمدة
          </button>
          
          {showColSettings && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-ink-200 rounded-xl shadow-xl z-50 p-4 font-sans text-right" dir="rtl">
              <h3 className="font-bold text-ink-900 mb-3 text-sm border-b border-ink-100 pb-2">تخصيص الأعمدة المعروضة</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto scroll-soft">
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.index}
                    onChange={(e) => setVisibleCol('index', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>الرقم التسلسلي</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.studentName}
                    onChange={(e) => setVisibleCol('studentName', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>الاسم</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.guardianPhone}
                    onChange={(e) => setVisibleCol('guardianPhone', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>رقم ولي الأمر</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.membershipNo}
                    onChange={(e) => setVisibleCol('membershipNo', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>رقم العضوية</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.stage}
                    onChange={(e) => setVisibleCol('stage', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>المرحلة / الصف</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.group}
                    onChange={(e) => setVisibleCol('group', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>المجموعة / الأسرة</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.nationalId}
                    onChange={(e) => setVisibleCol('nationalId', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>رقم الهوية</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.studentPhone}
                    onChange={(e) => setVisibleCol('studentPhone', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>جوال الطالب</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.neighborhood}
                    onChange={(e) => setVisibleCol('neighborhood', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>الحي السكني</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.paymentStatus}
                    onChange={(e) => setVisibleCol('paymentStatus', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>حالة الدفع</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.hasCondition}
                    onChange={(e) => setVisibleCol('hasCondition', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>الحالة الصحية</span>
                </label>
              </div>
              <div className="mt-3 pt-2 border-t border-ink-100 flex justify-end">
                <button
                  onClick={() => setShowColSettings(false)}
                  className="btn btn-primary text-xs py-1 px-3"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}

          <button onClick={exportCsv} className="btn btn-secondary text-sm flex items-center gap-1.5">
            ⬇︎ تصدير CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input with Clear Button */}
          <div className="relative flex items-center w-full">
            <input
              className="field pl-8 w-full"
              placeholder="بحث بالاسم / الهوية / الجوال / العضوية…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-2.5 text-ink-400 hover:text-ink-900 text-lg font-bold leading-none p-1"
                title="مسح البحث"
              >
                ×
              </button>
            )}
          </div>

          {/* Stage Dropdown with Clear Button */}
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 min-w-0">
              <StageMultiSelectDropdown
                selected={fStages}
                onChange={setFStages}
              />
            </div>
            {fStages.length > 0 && (
              <button
                onClick={() => setFStages([])}
                className="text-ink-400 hover:text-ink-900 text-xl font-bold p-1 leading-none shrink-0"
                title="مسح تصفية المراحل"
              >
                ×
              </button>
            )}
          </div>

          {/* Group Dropdown with Clear Button */}
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 min-w-0">
              <MultiSelectDropdown
                label="تصفية المجموعات"
                options={groups.map((g) => ({ value: String(g.id), label: g.name }))}
                selected={fGroups}
                onChange={setFGroups}
              />
            </div>
            {fGroups.length > 0 && (
              <button
                onClick={() => setFGroups([])}
                className="text-ink-400 hover:text-ink-900 text-xl font-bold p-1 leading-none shrink-0"
                title="مسح تصفية المجموعات"
              >
                ×
              </button>
            )}
          </div>

          {/* Neighborhood Dropdown with Clear Button */}
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 min-w-0">
              <MultiSelectDropdown
                label="تصفية الأحياء"
                options={neighborhoods.map((n) => ({ value: n, label: n }))}
                selected={fNeighborhoods}
                onChange={setFNeighborhoods}
              />
            </div>
            {fNeighborhoods.length > 0 && (
              <button
                onClick={() => setFNeighborhoods([])}
                className="text-ink-400 hover:text-ink-900 text-xl font-bold p-1 leading-none shrink-0"
                title="مسح تصفية الأحياء"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-ink-400 text-sm">لا يوجد طلاب مطابقون.</p>
        ) : (
          <>
            {/* desktop: table */}
            <div className="hidden lg:block overflow-x-auto scroll-soft">
              <table className="tbl">
                <thead>
                  <tr>
                    {visibleCols.index && <th>الرقم</th>}
                    {visibleCols.studentName && <th>الطالب</th>}
                    {visibleCols.membershipNo && <th>العضوية</th>}
                    {visibleCols.guardianPhone && <th>رقم ولي الأمر</th>}
                    {visibleCols.stage && <th>المرحلة / الصف</th>}
                    {visibleCols.group && <th>المجموعة</th>}
                    {visibleCols.nationalId && <th>رقم الهوية</th>}
                    {visibleCols.studentPhone && <th>جوال الطالب</th>}
                    {visibleCols.neighborhood && <th>الحي</th>}
                    {visibleCols.paymentStatus && <th>الدفع</th>}
                    {visibleCols.hasCondition && <th>الحالة الصحية</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => {
                    const pp = paymentPill(s);
                    const groupName = groups.find((g) => g.id === s.groupId)?.name || 'بدون مجموعة';
                    return (
                      <tr key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                        {visibleCols.index && (
                          <td className="text-ink-500 text-sm font-mono">{idx + 1}</td>
                        )}
                        {visibleCols.studentName && (
                          <td className="font-medium">
                            {s.studentName}
                            {s.hasCondition && <span title="حالة صحية" className="mr-1">🚨</span>}
                          </td>
                        )}
                        {visibleCols.membershipNo && (
                          <td dir="ltr" className="text-right font-mono text-ink-500">#{s.membershipNo}</td>
                        )}
                        {visibleCols.guardianPhone && (
                          <td dir="ltr" className="text-right font-mono text-ink-500">{s.guardianPhone}</td>
                        )}
                        {visibleCols.stage && (
                          <td className="text-ink-500 text-sm">{s.stage} — {s.grade}</td>
                        )}
                        {visibleCols.group && (
                          <td className="text-ink-500 text-sm">{groupName}</td>
                        )}
                        {visibleCols.nationalId && (
                          <td dir="ltr" className="text-right font-mono text-ink-500">{s.nationalId}</td>
                        )}
                        {visibleCols.studentPhone && (
                          <td dir="ltr" className="text-right font-mono text-ink-500">{s.studentPhone || '—'}</td>
                        )}
                        {visibleCols.neighborhood && (
                          <td className="text-ink-500 text-sm">{s.neighborhood}</td>
                        )}
                        {visibleCols.paymentStatus && (
                          <td><span className={`pill ${pp.cls}`}>{pp.label}</span></td>
                        )}
                        {visibleCols.hasCondition && (
                          <td className="text-ink-500 text-sm">
                            {s.hasCondition ? (s.conditionNote || 'نعم 🚨') : 'لا'}
                          </td>
                        )}
                        <td>
                          <button
                            className="btn btn-secondary py-1 px-3 text-xs"
                            onClick={(e) => { e.stopPropagation(); setSelected(s); }}
                          >
                            عرض
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* mobile: tappable cards (no horizontal scroll) */}
            <ul className="lg:hidden divide-y divide-ink-200">
              {filtered.map((s, idx) => {
                const pp = paymentPill(s);
                const groupName = groups.find((g) => g.id === s.groupId)?.name || 'بدون مجموعة';
                return (
                  <li
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="py-3 px-4 flex items-center gap-3 active:bg-cream-100 cursor-pointer text-right"
                    dir="rtl"
                  >
                    {visibleCols.index && (
                      <div className="text-ink-400 font-mono text-sm shrink-0 min-w-[1.5rem] text-center">
                        {idx + 1}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      {visibleCols.studentName && (
                        <div className="font-semibold text-ink-900 truncate">
                          {s.studentName}
                          {s.hasCondition && <span title="حالة صحية" className="mr-1">🚨</span>}
                        </div>
                      )}
                      
                      <div className="text-xs text-ink-500 flex flex-wrap gap-x-2 gap-y-1">
                        {visibleCols.membershipNo && (
                          <span dir="ltr" className="font-mono">#{s.membershipNo}</span>
                        )}
                        {visibleCols.stage && (
                          <>
                            {visibleCols.membershipNo && <span className="text-ink-300">·</span>}
                            <span>{s.stage} — {s.grade}</span>
                          </>
                        )}
                        {visibleCols.group && (
                          <>
                            {(visibleCols.membershipNo || visibleCols.stage) && <span className="text-ink-300">·</span>}
                            <span>{groupName}</span>
                          </>
                        )}
                      </div>

                      <div className="text-xs text-ink-500 space-y-0.5">
                        {visibleCols.guardianPhone && (
                          <div>
                            <span className="text-ink-400">ولي الأمر: </span>
                            <span dir="ltr">{s.guardianPhone}</span>
                          </div>
                        )}
                        {visibleCols.studentPhone && s.studentPhone && (
                          <div>
                            <span className="text-ink-400">جوال الطالب: </span>
                            <span dir="ltr">{s.studentPhone}</span>
                          </div>
                        )}
                        {visibleCols.nationalId && (
                          <div>
                            <span className="text-ink-400">رقم الهوية: </span>
                            <span dir="ltr">{s.nationalId}</span>
                          </div>
                        )}
                        {visibleCols.neighborhood && (
                          <div>
                            <span className="text-ink-400">الحي: </span>
                            <span>{s.neighborhood}</span>
                          </div>
                        )}
                      </div>

                      {(visibleCols.paymentStatus || (visibleCols.hasCondition && s.hasCondition)) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {visibleCols.paymentStatus && (
                            <span className={`pill ${pp.cls}`}>{pp.label}</span>
                          )}
                          {visibleCols.hasCondition && s.hasCondition && (
                            <span className="pill pill-red">🚨 {s.conditionNote || 'حالة صحية'}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-ink-300 text-xl shrink-0">‹</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {selected && (
        <StudentModal
          student={selected}
          groups={groups}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onUpdated={applyUpdate}
          onDeleted={(id) => {
            setStudents((prev) => prev.filter((s) => s.id !== id));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

/* ============================= MODAL ============================= */

function StudentModal({
  student,
  groups,
  isAdmin,
  onClose,
  onUpdated,
  onDeleted
}: {
  student: Student;
  groups: Group[];
  isAdmin: boolean;
  onClose: () => void;
  onUpdated: (s: Student) => void;
  onDeleted: (id: number) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Student>(student);

  useEffect(() => setForm(student), [student]);

  const stageDef = stages.find((s) => s.key === form.stage);

  async function put(patch: Partial<Student>) {
    setBusy(true);
    const r = await fetch('/api/supervisor/students', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: student.id, ...patch })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل التحديث');
      return null;
    }
    onUpdated(j.student);
    return j.student as Student;
  }

  async function confirmPayment() {
    const res = await put({ paymentStatus: 'paid' });
    if (res) pushToast('success', 'تم تأكيد استلام الدفع');
  }

  async function setReg(status: string) {
    const res = await put({ registrationStatus: status });
    if (res) pushToast('success', status === 'approved' ? 'تم قبول الطالب' : status === 'rejected' ? 'تم رفض الطلب' : 'تم التحديث');
  }

  async function saveEdit() {
    const res = await put({
      studentName: form.studentName,
      nationalId: form.nationalId,
      guardianPhone: form.guardianPhone,
      studentPhone: form.studentPhone,
      stage: form.stage,
      grade: form.grade,
      neighborhood: form.neighborhood,
      hasCondition: form.hasCondition,
      conditionNote: form.hasCondition ? form.conditionNote : null,
      groupId: form.groupId
    });
    if (res) {
      pushToast('success', 'تم حفظ التعديلات');
      setEdit(false);
    }
  }

  async function del() {
    if (!confirm(`حذف الطالب «${student.studentName}» نهائياً؟`)) return;
    setBusy(true);
    const r = await fetch(`/api/supervisor/students?id=${student.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return pushToast('error', j.error ?? 'فشل الحذف');
    }
    pushToast('info', 'تم حذف الطالب');
    onDeleted(student.id);
  }

  async function openReceipt() {
    if (!student.paymentReceipt) return;
    try {
      const res = await fetch(student.paymentReceipt);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      window.open(student.paymentReceipt, '_blank');
    }
  }

  function copyWhatsapp() {
    const locLine = student.mapLink
      ? student.mapLink
      : student.locationLat && student.locationLng
      ? `https://maps.google.com/?q=${student.locationLat},${student.locationLng}`
      : 'غير محدد';
    const msg =
      `*بيانات تسجيل الطالب في نادي نبراس:*\n` +
      `اسم الطالب: ${student.studentName}\n` +
      `رقم العضوية: #${student.membershipNo}\n` +
      `رقم الهوية: ${student.nationalId}\n` +
      `المرحلة: ${student.stage} - ${student.grade}\n` +
      `جوال ولي الأمر: ${student.guardianPhone}\n` +
      `الحي: ${student.neighborhood}\n` +
      `الموقع: ${locLine}`;
    navigator.clipboard.writeText(msg).then(
      () => pushToast('success', 'تم نسخ بيانات الطالب'),
      () => pushToast('error', 'تعذّر النسخ')
    );
  }

  const pp = paymentPill(student);
  const rp = regPill(student.registrationStatus);
  const mapsHref = student.mapLink
    ? student.mapLink
    : student.locationLat && student.locationLng
    ? `https://www.google.com/maps?q=${student.locationLat},${student.locationLng}`
    : null;

  return (
    <div className="modal-backdrop flex items-start md:items-center justify-center p-2 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="modal-panel w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-ink-200">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink-900">{student.studentName}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span dir="ltr" className="text-xs sm:text-sm font-mono text-ink-500">#{student.membershipNo}</span>
              <span className={`pill ${pp.cls}`}>{pp.label}</span>
              <span className={`pill ${rp.cls}`}>{rp.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 max-h-[70vh] overflow-y-auto scroll-soft">
          {edit ? (
            /* ---------- EDIT MODE ---------- */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Labeled label="اسم الطالب">
                <input className="field" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
              </Labeled>
              <Labeled label="رقم الهوية">
                <input className="field" dir="ltr" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
              </Labeled>
              <Labeled label="جوال ولي الأمر">
                <input className="field" dir="ltr" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
              </Labeled>
              <Labeled label="جوال الطالب">
                <input className="field" dir="ltr" value={form.studentPhone ?? ''} onChange={(e) => setForm({ ...form, studentPhone: e.target.value })} />
              </Labeled>
              <Labeled label="المرحلة">
                <select className="field" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value, grade: '' })}>
                  {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Labeled>
              <Labeled label="الصف">
                <select className="field" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                  <option value="">اختر الصف</option>
                  {stageDef?.grades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Labeled>
              <Labeled label="الحي السكني">
                <input className="field" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
              </Labeled>
              <Labeled label="المجموعة / الأسرة">
                <select
                  className="field"
                  value={form.groupId ?? ''}
                  onChange={(e) => setForm({ ...form, groupId: e.target.value ? parseInt(e.target.value, 10) : null })}
                >
                  <option value="">بدون مجموعة</option>
                  {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                </select>
              </Labeled>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasCondition}
                    onChange={(e) => setForm({ ...form, hasCondition: e.target.checked })}
                  />
                  يعاني من حساسية / مرض مزمن
                </label>
                {form.hasCondition && (
                  <textarea
                    className="field mt-2"
                    rows={2}
                    placeholder="تفاصيل الحالة"
                    value={form.conditionNote ?? ''}
                    onChange={(e) => setForm({ ...form, conditionNote: e.target.value })}
                  />
                )}
              </div>
            </div>
          ) : (
            /* ---------- VIEW MODE ---------- */
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6">
                <Info label="رقم الهوية" value={student.nationalId} ltr />
                <Info label="المرحلة / الصف" value={`${student.stage} — ${student.grade}`} />
                <Info label="جوال ولي الأمر" value={student.guardianPhone} ltr />
                <Info label="جوال الطالب" value={student.studentPhone || '—'} ltr />
                <Info label="الحي السكني" value={student.neighborhood} />
                <Info label="المجموعة" value={groups.find((g) => g.id === student.groupId)?.name || 'غير محدد'} />
              </div>

              {/* health */}
              {student.hasCondition && (
                <div className="rounded-lg p-3 text-sm" style={{ background: '#FDEAE6', color: '#C42910' }}>
                  🚨 <span className="font-semibold">حالة صحية:</span> {student.conditionNote || 'غير موضّحة'}
                </div>
              )}

              {/* location */}
              <div>
                <div className="label">الموقع</div>
                {mapsHref ? (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm">
                    📍 فتح الموقع في خرائط Google ↗
                  </a>
                ) : (
                  <span className="text-sm text-ink-400">لم يحدّد الطالب موقعاً.</span>
                )}
              </div>

              {/* payment */}
              <div className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-ink-900">تفاصيل الدفع</span>
                  <span className="pill pill-gray">{student.paymentType === 'now' ? 'دفع فوري' : 'دفع آجل'}</span>
                </div>

                {student.paymentType === 'now' && (
                  <div className="mb-3">
                    <div className="label">إيصال التحويل</div>
                    {student.paymentReceipt ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={student.paymentReceipt}
                          alt="إيصال"
                          className="w-20 h-20 object-cover rounded-lg border border-ink-200 cursor-pointer"
                          onClick={openReceipt}
                        />
                        <button onClick={openReceipt} className="btn btn-ghost text-sm">👁️ فتح الإيصال في صفحة جديدة</button>
                      </div>
                    ) : (
                      <span className="text-sm text-ink-400">لم يُرفق إيصال.</span>
                    )}
                  </div>
                )}

                {student.paymentStatus !== 'paid' ? (
                  <div className="rounded-lg p-3" style={{ background: '#FCF3DC' }}>
                    <p className="text-sm mb-2" style={{ color: '#9A6B00' }}>لم يتم تأكيد السداد بعد.</p>
                    {isAdmin && (
                      <button
                        onClick={confirmPayment}
                        disabled={busy}
                        className="btn text-white border-transparent"
                        style={{ background: '#1B7A43' }}
                      >
                        ✅ تأكيد استلام الدفع
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-semibold" style={{ color: '#1B7A43' }}>✓ تم تأكيد استلام الدفع</p>
                )}
              </div>

              {/* registration status (auto-determined by payment) */}
              <div>
                <div className="label">حالة التسجيل</div>
                <div className="flex items-center gap-2">
                  {student.paymentStatus === 'paid' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: '#DEF7E5', color: '#1B7A43' }}>
                      ✓ مقبول
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: '#FEF3CD', color: '#856404' }}>
                      ⏳ قيد المراجعة
                    </span>
                  )}
                  <span className="text-xs text-ink-400">(يتحدد تلقائياً حسب حالة الدفع)</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* footer actions */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-ink-200 flex-wrap">
          <div className="flex gap-2">
            {edit ? (
              <>
                <button onClick={saveEdit} disabled={busy} className="btn btn-primary text-sm">حفظ التعديلات</button>
                <button onClick={() => { setEdit(false); setForm(student); }} className="btn btn-ghost text-sm">إلغاء</button>
              </>
            ) : (
              <>
                {isAdmin && (
                  <button onClick={() => setEdit(true)} className="btn btn-secondary text-sm">✎ تعديل</button>
                )}
              </>
            )}
          </div>
          {isAdmin && !edit && (
            <button onClick={del} disabled={busy} className="btn btn-danger text-sm">حذف الطالب</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <div className="label !mb-0.5">{label}</div>
      <div className="text-ink-900 text-sm" dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'right' } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
