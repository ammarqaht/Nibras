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
  if (s.paymentStatus === 'exempted') return { cls: 'pill-blue', label: 'معفي' };
  if (s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted' && s.paymentType === 'now' && s.paymentReceipt) return { cls: 'pill-yellow', label: 'بانتظار المراجعة' };
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
  const roles = user?.role ? user.role.split(',').map((r) => r.trim()) : [];
  const isGlobal = roles.some((r) =>
    ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'media_officer', 'tasks_supervisor',
     'cultural_supervisor', 'social_supervisor', 'scientific_supervisor', 'sports_supervisor',
     'general_supervisor', 'attendance_supervisor'].includes(r)
  );
  const canSeeFullStudentDetails = roles.some((r) =>
    ['admin', 'finance', 'finance_supervisor', 'general_supervisor', 'media_officer', 'stage_supervisor'].includes(r)
  );
  const isStageSup  = !isGlobal && roles.includes('stage_supervisor');
  const isGroupsSup = !isGlobal && !isStageSup && roles.includes('groups_supervisor');

  const myGroupIds = useMemo(() => {
    if (!user?.groupIds) return new Set<number>();
    return new Set(user.groupIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)));
  }, [user]);
  const myStage = user?.stage ?? '';

  const [students, setStudents] = useState<Student[]>([]);

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);
  const [showHealthModal, setShowHealthModal] = useState(false);

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
    if (!canSeeFullStudentDetails) {
      setVisibleCols({
        index: true,
        studentName: true,
        guardianPhone: false,
        membershipNo: true,
        stage: true,
        group: true,
        nationalId: false,
        studentPhone: false,
        neighborhood: false,
        paymentStatus: false,
        hasCondition: true,
      });
      return;
    }

    const saved = localStorage.getItem('nibras_student_cols');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!isGlobal) {
          parsed.guardianPhone = false;
          parsed.studentPhone = false;
          parsed.paymentStatus = false;
        }
        setVisibleCols(parsed);
      } catch (e) {
        console.error(e);
      }
    } else if (!isGlobal) {
      setVisibleCols((prev) => ({
        ...prev,
        guardianPhone: false,
        studentPhone: false,
        paymentStatus: false
      }));
    }
  }, [isGlobal, canSeeFullStudentDetails]);

  useEffect(() => {
    if (!canSeeFullStudentDetails) return;
    if (!isGlobal) {
      setVisibleCols((prev) => ({
        ...prev,
        guardianPhone: false,
        studentPhone: false,
        paymentStatus: false
      }));
    }
  }, [isGlobal, canSeeFullStudentDetails]);


  const setVisibleCol = (key: keyof typeof visibleCols, val: boolean) => {
    if (!canSeeFullStudentDetails) return;
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: val };
      localStorage.setItem('nibras_student_cols', JSON.stringify(next));
      return next;
    });
  };

  async function load() {
    // isGlobal roles see all students; stage/groups supervisors are scoped server-side
    const studentsUrl = isGlobal
      ? '/api/supervisor/students?scope=all'
      : '/api/supervisor/students';
    const [sr, gr] = await Promise.all([
      fetch(studentsUrl, { cache: 'no-store' }),
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
    return students.filter((s) =>
      s.registrationStatus === 'approved' &&
      (s.paymentStatus === 'paid' || s.paymentStatus === 'exempted' || s.paymentStatus === '')
    );
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
    let headers: string[];
    let rows: any[][];

    if (!canSeeFullStudentDetails) {
      headers = ['رقم العضوية', 'اسم الطالب', 'المرحلة', 'الصف', 'الحالة الصحية'];
      rows = filtered.map((s) => [
        s.membershipNo, s.studentName, s.stage, s.grade, s.hasCondition ? 'نعم' : 'لا'
      ]);
    } else {
      headers = isGlobal ? [
        'رقم العضوية', 'اسم الطالب', 'رقم الهوية', 'جوال ولي الأمر', 'جوال الطالب',
        'المرحلة', 'الصف', 'الحي', 'حالة الدفع', 'نوع الدفع', 'حالة التسجيل', 'حالة صحية'
      ] : [
        'رقم العضوية', 'اسم الطالب', 'رقم الهوية',
        'المرحلة', 'الصف', 'الحي', 'نوع الدفع', 'حالة التسجيل', 'حالة صحية'
      ];
      rows = filtered.map((s) => isGlobal ? [
        s.membershipNo, s.studentName, s.nationalId, s.guardianPhone, s.studentPhone ?? '',
        s.stage, s.grade, s.neighborhood,
        s.paymentStatus === 'paid' ? 'مدفوع' : 'غير مدفوع',
        s.paymentType === 'now' ? 'فوري' : 'آجل',
        s.registrationStatus === 'approved' ? 'مقبول' : s.registrationStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة',
        s.hasCondition ? 'نعم' : 'لا'
      ] : [
        s.membershipNo, s.studentName, s.nationalId,
        s.stage, s.grade, s.neighborhood,
        s.paymentType === 'now' ? 'فوري' : 'آجل',
        s.registrationStatus === 'approved' ? 'مقبول' : s.registrationStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة',
        s.hasCondition ? 'نعم' : 'لا'
      ]);
    }

    const esc = (v: unknown) => {
      const str = String(v ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

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
            onClick={() => setShowHealthModal(true)}
            className="btn btn-secondary text-sm flex items-center gap-1.5 text-red-600 border-red-200 bg-red-50 hover:bg-red-100 font-semibold"
          >
            🚑 الحالات الصحية
          </button>
          {canSeeFullStudentDetails && (
            <button
              onClick={() => setShowColSettings(!showColSettings)}
              className="btn btn-secondary text-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>تخصيص الأعمدة</span>
            </button>
          )}
          
          {canSeeFullStudentDetails && showColSettings && (
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
                {isGlobal && (
                  <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                    <input
                      type="checkbox"
                      checked={visibleCols.guardianPhone}
                      onChange={(e) => setVisibleCol('guardianPhone', e.target.checked)}
                      className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                    <span>رقم ولي الأمر</span>
                  </label>
                )}

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
                {isGlobal && (
                  <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                    <input
                      type="checkbox"
                      checked={visibleCols.studentPhone}
                      onChange={(e) => setVisibleCol('studentPhone', e.target.checked)}
                      className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                    <span>جوال الطالب</span>
                  </label>
                )}

                <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    checked={visibleCols.neighborhood}
                    onChange={(e) => setVisibleCol('neighborhood', e.target.checked)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span>الحي السكني</span>
                </label>
                {isGlobal && (
                  <label className="flex items-center gap-2.5 text-sm text-ink-700 cursor-pointer hover:bg-cream-50 p-1.5 rounded-lg select-none">
                    <input
                      type="checkbox"
                      checked={visibleCols.paymentStatus}
                      onChange={(e) => setVisibleCol('paymentStatus', e.target.checked)}
                      className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                    <span>حالة الدفع</span>
                  </label>
                )}

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
          {isGlobal && (
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
          )}


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
                    {visibleCols.guardianPhone && isGlobal && <th>رقم ولي الأمر</th>}
                    {visibleCols.stage && <th>المرحلة / الصف</th>}
                    {visibleCols.group && <th>المجموعة</th>}
                    {visibleCols.nationalId && <th>رقم الهوية</th>}
                    {visibleCols.studentPhone && isGlobal && <th>جوال الطالب</th>}
                    {visibleCols.neighborhood && <th>الحي</th>}
                    {visibleCols.paymentStatus && isGlobal && <th>الدفع</th>}
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
                            {s.hasCondition && (
                              <span title="حالة صحية" className="mr-1 inline-flex items-center text-red-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                  <line x1="12" y1="9" x2="12" y2="13" />
                                  <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                              </span>
                            )}
                          </td>
                        )}
                        {visibleCols.membershipNo && (
                          <td dir="ltr" className="text-right font-mono text-ink-500">#{s.membershipNo}</td>
                        )}
                        {visibleCols.guardianPhone && isGlobal && (
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
                        {visibleCols.studentPhone && isGlobal && (
                          <td dir="ltr" className="text-right font-mono text-ink-500">{s.studentPhone || '—'}</td>
                        )}
                        {visibleCols.neighborhood && (
                          <td className="text-ink-500 text-sm">{s.neighborhood}</td>
                        )}
                        {visibleCols.paymentStatus && isGlobal && (
                          <td><span className={`pill ${pp.cls}`}>{pp.label}</span></td>
                        )}
                        {visibleCols.hasCondition && (
                          <td className="text-ink-500 text-sm">
                            {s.hasCondition ? (
                              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                  <line x1="12" y1="9" x2="12" y2="13" />
                                  <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <span>نعم</span>
                              </span>
                            ) : 'لا'}
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
            <ul className="lg:hidden divide-y divide-ink-100">
              {filtered.map((s, idx) => {
                const pp = paymentPill(s);
                const groupName = s.groupId ? (groups.find((g) => g.id === s.groupId)?.name ?? null) : null;
                return (
                  <li
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="py-3.5 px-4 flex items-start gap-2.5 active:bg-cream-100 cursor-pointer text-right"
                    dir="rtl"
                  >
                    {visibleCols.index && (
                      <div className="text-ink-300 font-mono text-xs shrink-0 pt-1 min-w-[1.5rem] text-center">
                        {idx + 1}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {/* Name row */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="font-bold text-ink-900 truncate text-sm leading-snug">{s.studentName}</span>
                        {s.hasCondition && (
                          <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        )}
                      </div>
                      {/* Badges row: membership + stage + group */}
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {visibleCols.membershipNo && (
                          <span dir="ltr" className="text-[10px] font-mono text-ink-400 bg-ink-50 border border-ink-200 px-1.5 py-0.5 rounded leading-none">#{s.membershipNo}</span>
                        )}
                        {visibleCols.stage && (
                          <span className="text-[10px] text-ink-600 bg-cream-100 px-1.5 py-0.5 rounded leading-none">{s.stage} · {s.grade}</span>
                        )}
                        {visibleCols.group && groupName && (
                          <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded leading-none">{groupName}</span>
                        )}
                        {visibleCols.group && !groupName && (
                          <span className="text-[10px] text-ink-300 px-1 leading-none">بدون أسرة</span>
                        )}
                      </div>
                      {/* Contact info row */}
                      {(visibleCols.guardianPhone || (visibleCols.studentPhone && s.studentPhone) || visibleCols.nationalId || visibleCols.neighborhood) && (
                        <div className="text-[11px] text-ink-500 space-y-0.5">
                          {visibleCols.guardianPhone && (
                            <div className="flex items-center gap-1">
                              <span className="text-ink-400">ولي الأمر:</span>
                              <span dir="ltr" className="font-mono">{s.guardianPhone}</span>
                            </div>
                          )}
                          {visibleCols.studentPhone && s.studentPhone && (
                            <div className="flex items-center gap-1">
                              <span className="text-ink-400">الطالب:</span>
                              <span dir="ltr" className="font-mono">{s.studentPhone}</span>
                            </div>
                          )}
                          {visibleCols.nationalId && (
                            <div className="flex items-center gap-1">
                              <span className="text-ink-400">الهوية:</span>
                              <span dir="ltr" className="font-mono">{s.nationalId}</span>
                            </div>
                          )}
                          {visibleCols.neighborhood && (
                            <div className="flex items-center gap-1">
                              <span className="text-ink-400">الحي:</span>
                              <span>{s.neighborhood}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Status pills */}
                      {((visibleCols.paymentStatus && isGlobal) || (visibleCols.hasCondition && s.hasCondition)) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {visibleCols.paymentStatus && isGlobal && (
                            <span className={`pill ${pp.cls} text-[10px]`}>{pp.label}</span>
                          )}
                          {visibleCols.hasCondition && s.hasCondition && (
                            <span className="pill pill-red text-[10px]">{s.conditionNote || 'حالة صحية'}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-ink-200 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
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
          isGlobal={isGlobal}
          canSeeFullDetails={canSeeFullStudentDetails}
          onClose={() => setSelected(null)}
          onUpdated={applyUpdate}
          onDeleted={(id) => {
            setStudents((prev) => prev.filter((s) => s.id !== id));
            setSelected(null);
          }}
        />

      )}

      {showHealthModal && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowHealthModal(false)}>
          <div className="modal-panel w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg text-ink-900 flex items-center gap-2">
                <span>🚑</span>
                <span>سجل الحالات الصحية للطلاب</span>
              </h3>
              <button onClick={() => setShowHealthModal(false)} className="btn btn-ghost p-2" aria-label="إغلاق">✕</button>
            </div>
            <div className="p-4 overflow-y-auto scroll-soft flex-1">
              {students.filter(s => s.registrationStatus === 'approved' && s.hasCondition).length === 0 ? (
                <p className="text-center py-10 text-ink-400 text-sm">لا توجد حالات صحية مسجلة للطلاب المقبولين.</p>
              ) : (
                <div className="overflow-x-auto border border-ink-200 rounded-xl">
                  <table className="tbl text-right font-sans" dir="rtl">
                    <thead>
                      <tr className="bg-ink-50">
                        <th className="p-3 font-bold text-xs text-ink-700">رقم العضوية</th>
                        <th className="p-3 font-bold text-xs text-ink-700">اسم الطالب</th>
                        <th className="p-3 font-bold text-xs text-ink-700">المرحلة والصف</th>
                        <th className="p-3 font-bold text-xs text-ink-700">تفاصيل الحالة الصحية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {students.filter(s => s.registrationStatus === 'approved' && s.hasCondition).map(s => (
                        <tr key={s.id} className="hover:bg-cream-50/30 transition-colors">
                          <td className="p-3 text-xs font-mono text-ink-500">#{s.membershipNo}</td>
                          <td className="p-3 text-xs font-bold text-ink-900">{s.studentName}</td>
                          <td className="p-3 text-xs text-ink-600">{s.stage} — {s.grade}</td>
                          <td className="p-3 text-xs text-red-700 font-semibold bg-red-50/10 whitespace-pre-wrap">{s.conditionNote || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setShowHealthModal(false)} className="btn btn-secondary text-sm px-4 py-2">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================= MODAL ============================= */

function StudentModal({
  student,
  groups,
  isAdmin,
  isGlobal,
  canSeeFullDetails,
  onClose,
  onUpdated,
  onDeleted
}: {
  student: Student;
  groups: Group[];
  isAdmin: boolean;
  isGlobal: boolean;
  canSeeFullDetails: boolean;
  onClose: () => void;
  onUpdated: (s: Student) => void;
  onDeleted: (id: number) => void;
}) {

  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Student>(student);

  useEffect(() => setForm(student), [student]);

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

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

  async function setExempted() {
    if (!window.confirm('هل أنت متأكد من إعفاء الطالب من الرسوم؟')) return;
    const res = await put({ paymentStatus: 'exempted' });
    if (res) pushToast('success', 'تم إعفاء الطالب من الرسوم');
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
    if (student.paymentReceipt.startsWith('data:')) {
      const w = window.open();
      if (w) {
        w.document.write(`
          <html>
            <head>
              <title>إيصال التحويل</title>
              <style>
                body { margin: 0; display: flex; align-items: center; justify-content: center; background: #000; min-height: 100vh; }
                img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${student.paymentReceipt}" alt="Receipt" />
            </body>
          </html>
        `);
        w.document.close();
      }
    } else {
      window.open(student.paymentReceipt, '_blank');
    }
  }

  function copyWhatsapp() {
    const locLine = student.mapLink
      ? student.mapLink
      : student.locationLat && student.locationLng
      ? `https://maps.google.com/?q=${student.locationLat},${student.locationLng}`
      : 'غير محدد';
    const msg = !canSeeFullDetails
      ? `*بيانات تسجيل الطالب في نادي نبراس:*\n` +
        `اسم الطالب: ${student.studentName}\n` +
        `رقم العضوية: #${student.membershipNo}\n` +
        `المرحلة: ${student.stage} - ${student.grade}\n` +
        `المجموعة: ${groups.find((g) => g.id === student.groupId)?.name || 'غير محدد'}\n` +
        `الحالة الصحية: ${student.hasCondition ? (student.conditionNote || 'نعم') : 'لا'}`
      : `*بيانات تسجيل الطالب في نادي نبراس:*\n` +
        `اسم الطالب: ${student.studentName}\n` +
        `رقم العضوية: #${student.membershipNo}\n` +
        `رقم الهوية: ${student.nationalId}\n` +
        `المرحلة: ${student.stage} - ${student.grade}\n` +
        (isGlobal ? `جوال ولي الأمر: ${student.guardianPhone}\n` : '') +
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

  const formattedGuardianPhone = student.guardianPhone.startsWith('05')
    ? '966' + student.guardianPhone.slice(1)
    : student.guardianPhone.startsWith('+')
    ? student.guardianPhone.slice(1)
    : student.guardianPhone;
  const guardianWhatsappUrl = `https://wa.me/${formattedGuardianPhone}`;

  const formattedStudentPhone = student.studentPhone
    ? student.studentPhone.startsWith('05')
      ? '966' + student.studentPhone.slice(1)
      : student.studentPhone.startsWith('+')
      ? student.studentPhone.slice(1)
      : student.studentPhone
    : null;
  const studentWhatsappUrl = formattedStudentPhone ? `https://wa.me/${formattedStudentPhone}` : null;

  return (
    <div className="modal-backdrop flex items-center justify-center p-2 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="modal-panel w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-ink-200">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink-900">{student.studentName}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span dir="ltr" className="text-xs sm:text-sm font-mono text-ink-500">#{student.membershipNo}</span>
              {canSeeFullDetails && (
                <>
                  <span className={`pill ${pp.cls}`}>{pp.label}</span>
                  <span className={`pill ${rp.cls}`}>{rp.label}</span>
                </>
              )}
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
                {canSeeFullDetails && <Info label="رقم الهوية" value={student.nationalId} ltr />}
                <Info label="المرحلة / الصف" value={`${student.stage} — ${student.grade}`} />
                {canSeeFullDetails && <Info label="الحي السكني" value={student.neighborhood} />}
                <Info label="المجموعة" value={groups.find((g) => g.id === student.groupId)?.name || 'غير محدد'} />
              </div>

              {/* Contact Actions */}
              {isGlobal && canSeeFullDetails && (
                <div className="border-t border-ink-200 pt-4 space-y-3">
                  <h4 className="font-bold text-xs text-ink-500">بيانات الاتصال والتواصل</h4>
                  
                  {/* Guardian contact */}
                  <div className="flex items-center justify-between bg-cream-50 p-2.5 rounded-lg border border-line">
                    <div>
                      <span className="text-xs text-ink-500 block">ولي الأمر</span>
                      <span dir="ltr" className="font-mono text-xs text-ink-800">{student.guardianPhone}</span>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${student.guardianPhone}`}
                        className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 rounded-md"
                      >
                        <svg className="w-3.5 h-3.5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <span>اتصال</span>
                      </a>
                      <a
                        href={guardianWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn text-white py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-md"
                        style={{ background: '#128C7E' }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <span>واتساب</span>
                      </a>
                    </div>
                  </div>

                  {/* Student contact */}
                  {student.studentPhone && (
                    <div className="flex items-center justify-between bg-cream-50 p-2.5 rounded-lg border border-line">
                      <div>
                        <span className="text-xs text-ink-500 block">جوال الطالب</span>
                        <span dir="ltr" className="font-mono text-xs text-ink-800">{student.studentPhone}</span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`tel:${student.studentPhone}`}
                          className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 rounded-md"
                        >
                          <svg className="w-3.5 h-3.5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          <span>اتصال</span>
                        </a>
                        {studentWhatsappUrl && (
                          <a
                            href={studentWhatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn text-white py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-md"
                            style={{ background: '#128C7E' }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            <span>واتساب</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* health */}
              {student.hasCondition && (
                <div className="rounded-lg p-3 text-sm flex items-start gap-1.5" style={{ background: '#FDEAE6', color: '#C42910' }}>
                  <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <span className="font-semibold">حالة صحية:</span> {student.conditionNote || 'غير موضّحة'}
                  </div>
                </div>
              )}

              {/* location */}
              {canSeeFullDetails && (
                <div className="bg-cream-50/60 border border-ink-200/60 rounded-xl p-3.5 shadow-sm">
                  <div className="text-[11px] font-bold text-ink-500 mb-2">الموقع الجغرافي</div>
                  {mapsHref ? (
                    <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm flex items-center justify-between w-full hover:bg-cream-200 transition-colors duration-150">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>فتح الموقع في خرائط Google</span>
                      </div>
                      <svg className="w-3.5 h-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-sm text-ink-400">لم يحدّد الطالب موقعاً.</span>
                  )}
                </div>
              )}

              {/* payment */}
              {isGlobal && canSeeFullDetails && (
                <div className="bg-cream-50/60 border border-ink-200/60 rounded-xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-ink-900 text-sm">تفاصيل الدفع</span>
                    <span className="pill pill-gray text-xs">{student.paymentType === 'now' ? 'دفع فوري' : 'دفع آجل'}</span>
                  </div>

                  {student.paymentType === 'now' && (
                    <div className="mb-3">
                      <div className="label">إيصال التحويل</div>
                      {student.paymentReceipt ? (
                        <button onClick={openReceipt} className="btn btn-secondary text-sm w-full justify-center gap-2 flex items-center">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>عرض إيصال التحويل في صفحة جديدة</span>
                        </button>
                      ) : (
                        <span className="text-sm text-ink-400">لم يُرفق إيصال.</span>
                      )}
                    </div>
                  )}

                  {student.paymentStatus !== 'paid' && student.paymentStatus !== 'exempted' ? (
                    <div className="rounded-lg p-3" style={{ background: '#FCF3DC' }}>
                      <p className="text-sm mb-2" style={{ color: '#9A6B00' }}>لم يتم تأكيد السداد بعد.</p>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            onClick={confirmPayment}
                            disabled={busy}
                            className="btn text-white border-transparent text-xs py-1.5 px-3 flex-1 justify-center flex items-center gap-1"
                            style={{ background: '#1B7A43' }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>تأكيد الدفع</span>
                          </button>
                          <button
                            onClick={setExempted}
                            disabled={busy}
                            className="btn btn-secondary text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs py-1.5 px-3 flex-1 justify-center"
                          >
                            إعفاء
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold">
                      {student.paymentStatus === 'exempted' ? (
                        <span className="flex items-center gap-1.5 text-blue-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>تم إعفاء الطالب من الرسوم</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-green-700">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>تم تأكيد استلام الدفع</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* registration status (auto-determined by payment) */}
              {canSeeFullDetails && (
                <div className="bg-cream-50/60 border border-ink-200/60 rounded-xl p-3.5 shadow-sm">
                  <div className="text-[11px] font-bold text-ink-500 mb-2">حالة التسجيل</div>
                  <div className="flex items-center gap-2">
                    {student.paymentStatus === 'paid' || student.paymentStatus === 'exempted' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#DEF7E5', color: '#1B7A43' }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>مقبول</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#FEF3CD', color: '#856404' }}>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
                        </svg>
                        <span>قيد المراجعة</span>
                      </span>
                    )}
                    <span className="text-xs text-ink-400">(يتحدد تلقائياً حسب حالة الدفع)</span>
                  </div>
                </div>
              )}
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
                {isAdmin && canSeeFullDetails && (
                  <button onClick={() => setEdit(true)} className="btn btn-secondary text-sm flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
                    </svg>
                    <span>تعديل</span>
                  </button>
                )}
              </>
            )}
          </div>
          {isAdmin && !edit && canSeeFullDetails && (
            <button onClick={del} disabled={busy} className="btn btn-danger text-sm">حذف الطالب</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="bg-cream-50/60 border border-ink-200/60 rounded-xl p-3.5 shadow-sm transition-all hover:bg-cream-100/50 duration-200">
      <div className="text-[11px] font-bold text-ink-500 mb-1">{label}</div>
      <div className="text-ink-900 font-semibold text-sm" dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'right' } : undefined}>
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
