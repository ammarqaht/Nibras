'use client';

import { useEffect, useMemo, useState } from 'react';
import { stages } from '@/content';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Group = { id: number; name: string; stage: string };
type Student = { id: number; studentName: string; stage: string; grade: string; groupId: number | null; registrationStatus: string; paymentStatus: string };
type Supervisor = { id: number; name: string; groupIds: string };

const CATEGORIES = [
  { key: 'behavior', label: 'سلوك' },
  { key: 'participation', label: 'مشاركة' },
  { key: 'activity', label: 'نشاط' },
  { key: 'other', label: 'أخرى' }
];
const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k;

function formatDate(dStr: string) {
  try {
    const d = new Date(dStr);
    return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  } catch (e) {
    return dStr;
  }
}

export default function GroupsPage() {
  const { user } = useSupervisor();
  const roles = user?.role ? user.role.split(',').map((r) => r.trim()) : [];
  const isAdmin = roles.includes('admin');
  const isStage = roles.includes('stage_supervisor');
  const isGroupsSup = roles.includes('groups_supervisor');
  const canManageGroups = isStage || isAdmin;
  const isGlobal = roles.some((r) =>
    ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
  );
  // stage_supervisor: which stage are they assigned to (from their account)
  const supervisorStage = (user as any)?.stage ?? '';

  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [stage, setStage] = useState<string>(stages[0].key);
  const [busy, setBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Record<number, number>>({});
  const [selectedGroupModal, setSelectedGroupModal] = useState<Group | null>(null);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [checkedNewGroupStudentIds, setCheckedNewGroupStudentIds] = useState<number[]>([]);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [checkedAddStudentIds, setCheckedAddStudentIds] = useState<number[]>([]);

  async function load() {
    const [gr, sr, su, pr] = await Promise.all([
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/supervisors', { cache: 'no-store' }),
      fetch('/api/supervisor/points', { cache: 'no-store' })
    ]);
    const grj = await gr.json().catch(() => ({ groups: [] }));
    const srj = await sr.json().catch(() => ({ students: [] }));
    const suj = await su.json().catch(() => ({ supervisors: [] }));
    const prj = await pr.json().catch(() => ({ points: [] }));
    
    setGroups(grj.groups ?? []);
    setSupervisors(suj.supervisors ?? []);
    setPoints(prj.points ?? []);
    const allSt: Student[] = srj.students ?? [];
    setStudents(allSt.filter((s) => s.registrationStatus === 'approved' && (s.paymentStatus === 'paid' || s.paymentStatus === 'exempted' || s.paymentStatus === '')));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const countOf = useMemo(() => {
    const m = new Map<number, number>();
    students.forEach((s) => { if (s.groupId != null) m.set(s.groupId, (m.get(s.groupId) ?? 0) + 1); });
    return (id: number) => m.get(id) ?? 0;
  }, [students]);

  const studentPointsMap = useMemo(() => {
    const m = new Map<number, number>();
    points.forEach((p) => m.set(p.registrationId, (m.get(p.registrationId) ?? 0) + p.delta));
    return m;
  }, [points]);

  const getStudentPoints = (id: number) => studentPointsMap.get(id) ?? 0;

  const getGroupPoints = (gId: number) => {
    const groupStudents = students.filter((s) => s.groupId === gId);
    if (groupStudents.length === 0) return 0;
    const groupPoints = points.filter(p =>
      p.reason.endsWith('(رصد جماعي للأسرة)') &&
      groupStudents.some(s => s.id === p.registrationId)
    );
    const uniqueEvents = new Map<string, number>();
    groupPoints.forEach(p => {
      const key = `${p.reason}-${p.delta}-${p.createdAt}`;
      uniqueEvents.set(key, p.delta);
    });
    return Array.from(uniqueEvents.values()).reduce((sum, d) => sum + d, 0);
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return pushToast('error', 'أدخل اسم المجموعة');
    setBusy(true);
    const r = await fetch('/api/supervisor/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), stage })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success || !j.group) {
      setBusy(false);
      return pushToast('error', j.error ?? 'فشل إنشاء المجموعة');
    }
    const newGroupId = j.group.id;
    if (checkedNewGroupStudentIds.length > 0) {
      const assignments = checkedNewGroupStudentIds.map(stId => ({ studentId: stId, groupId: newGroupId }));
      const bulkR = await fetch('/api/supervisor/students/bulk-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments })
      });
      if (!bulkR.ok) {
        pushToast('error', 'تم إنشاء المجموعة ولكن تعذر تعيين الطلاب المحددين');
      }
    }
    setBusy(false);
    pushToast('success', 'تم إنشاء المجموعة بنجاح');
    setName('');
    setCheckedNewGroupStudentIds([]);
    setShowCreateGroupModal(false);
    load();
  }

  async function removeStudentFromGroup(studentId: number) {
    if (!window.confirm('هل أنت متأكد من إزالة هذا الطالب من المجموعة؟')) return;
    setBusy(true);
    const r = await fetch('/api/supervisor/students/bulk-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments: [{ studentId, groupId: null }] })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل إزالة الطالب من المجموعة');
    } else {
      pushToast('success', 'تمت إزالة الطالب من المجموعة بنجاح');
      load();
    }
  }

  async function handleAddStudentsSubmit() {
    if (checkedAddStudentIds.length === 0 || !selectedGroupModal) return;
    setBusy(true);
    const assignments = checkedAddStudentIds.map(stId => ({ studentId: stId, groupId: selectedGroupModal.id }));
    const r = await fetch('/api/supervisor/students/bulk-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل إضافة الطلاب للمجموعة');
    } else {
      pushToast('success', 'تم إضافة الطلاب للمجموعة بنجاح');
      setShowAddStudents(false);
      setCheckedAddStudentIds([]);
      load();
    }
  }

  async function deleteGroup(id: number) {
    if (!window.confirm('هل أنت متأكد من حذف هذه المجموعة؟ سيتم إزالة جميع الطلاب منها.')) return;
    setBusy(true);
    const r = await fetch(`/api/supervisor/groups?id=${id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) {
      pushToast('error', 'فشل حذف المجموعة');
    } else {
      pushToast('success', 'تم حذف المجموعة بنجاح');
      if (selectedGroupModal?.id === id) setSelectedGroupModal(null);
      load();
    }
  }

  const unassignedStudents = useMemo(() => {
    return students.filter(s => s.groupId === null);
  }, [students]);

  const filteredUnassigned = useMemo(() => {
    return unassignedStudents.filter(s => {
      const matchSearch = s.studentName.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchStage = stageFilter ? s.stage === stageFilter : true;
      return matchSearch && matchStage;
    });
  }, [unassignedStudents, searchQuery, stageFilter]);

  async function assignGroup(studentId: number, groupId: number) {
    if (!groupId) return;
    setBusy(true);
    const r = await fetch('/api/supervisor/students/bulk-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments: [{ studentId, groupId }] })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل تعيين الطالب للمجموعة');
    } else {
      pushToast('success', 'تم تعيين الطالب للمجموعة بنجاح');
      setSelectedGroups(prev => {
        const copy = { ...prev };
        delete copy[studentId];
        return copy;
      });
      load();
    }
  }

  async function downloadTemplate() {
    try {
      const XLSX = await import('xlsx');
      
      const primaryStudents = students.filter(s => s.stage === 'ابتدائي');
      const intermediateStudents = students.filter(s => s.stage === 'متوسط');
      const secondaryStudents = students.filter(s => s.stage === 'ثانوي');

      const maxLength = Math.max(
        primaryStudents.length,
        intermediateStudents.length,
        secondaryStudents.length,
        1
      );

      const data: any[] = [];
      data.push({
        A: 'اسم الطالب (ابتدائي)',
        B: 'رقم الطالب (لا تعدل)',
        C: 'الأسرة/المجموعة (ابتدائي)',
        D: 'اسم الطالب (متوسط)',
        E: 'رقم الطالب (لا تعدل)',
        F: 'الأسرة/المجموعة (متوسط)',
        G: 'اسم الطالب (ثانوي)',
        H: 'رقم الطالب (لا تعدل)',
        I: 'الأسرة/المجموعة (ثانوي)'
      });

      for (let i = 0; i < maxLength; i++) {
        const p = primaryStudents[i];
        const m = intermediateStudents[i];
        const s = secondaryStudents[i];

        const pGroup = p?.groupId ? groups.find(g => g.id === p.groupId)?.name : '';
        const mGroup = m?.groupId ? groups.find(g => g.id === m.groupId)?.name : '';
        const sGroup = s?.groupId ? groups.find(g => g.id === s.groupId)?.name : '';

        data.push({
          A: p ? p.studentName : '',
          B: p ? p.id : '',
          C: p ? pGroup : '',
          D: m ? m.studentName : '',
          E: m ? m.id : '',
          F: m ? mGroup : '',
          G: s ? s.studentName : '',
          H: s ? s.id : '',
          I: s ? sGroup : ''
        });
      }

      const ws = XLSX.utils.json_to_sheet(data, { skipHeader: true });
      ws['!cols'] = [
        { wch: 25 }, { wch: 18 }, { wch: 22 },
        { wch: 25 }, { wch: 18 }, { wch: 22 },
        { wch: 25 }, { wch: 18 }, { wch: 22 }
      ];

      const primaryGroupNames = groups.filter(g => g.stage === 'ابتدائي').map(g => g.name);
      const intermediateGroupNames = groups.filter(g => g.stage === 'متوسط').map(g => g.name);
      const secondaryGroupNames = groups.filter(g => g.stage === 'ثانوي').map(g => g.name);

      if (primaryGroupNames.length > 0) {
        if (!ws['!dataValidation']) ws['!dataValidation'] = [];
        ws['!dataValidation'].push({
          sqref: `C2:C${maxLength + 1}`,
          formula1: `"${primaryGroupNames.join(',')}"`,
          type: 'list',
          allowBlank: true
        });
      }
      if (intermediateGroupNames.length > 0) {
        if (!ws['!dataValidation']) ws['!dataValidation'] = [];
        ws['!dataValidation'].push({
          sqref: `F2:F${maxLength + 1}`,
          formula1: `"${intermediateGroupNames.join(',')}"`,
          type: 'list',
          allowBlank: true
        });
      }
      if (secondaryGroupNames.length > 0) {
        if (!ws['!dataValidation']) ws['!dataValidation'] = [];
        ws['!dataValidation'].push({
          sqref: `I2:I${maxLength + 1}`,
          formula1: `"${secondaryGroupNames.join(',')}"`,
          type: 'list',
          allowBlank: true
        });
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تقسيم الطلاب');
      XLSX.writeFile(wb, 'قالب_توزيع_الطلاب_على_الأسر.xlsx');
    } catch (err) {
      console.error(err);
      pushToast('error', 'حدث خطأ أثناء تحميل القالب');
    }
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const assignments: { studentId: number; groupId: number | null }[] = [];

        for (let idx = 1; idx < rows.length; idx++) {
          const row = rows[idx];
          if (!row || row.length === 0) continue;

          // Primary
          const pId = parseInt(row[1], 10);
          const pGroupName = row[2]?.toString().trim();
          if (!isNaN(pId)) {
            const student = students.find(s => s.id === pId);
            if (student) {
              if (pGroupName) {
                const group = groups.find(g => g.stage === 'ابتدائي' && g.name.toLowerCase() === pGroupName.toLowerCase());
                if (group) {
                  assignments.push({ studentId: pId, groupId: group.id });
                }
              }
            }
          }

          // Intermediate
          const mId = parseInt(row[4], 10);
          const mGroupName = row[5]?.toString().trim();
          if (!isNaN(mId)) {
            const student = students.find(s => s.id === mId);
            if (student) {
              if (mGroupName) {
                const group = groups.find(g => g.stage === 'متوسط' && g.name.toLowerCase() === mGroupName.toLowerCase());
                if (group) {
                  assignments.push({ studentId: mId, groupId: group.id });
                }
              }
            }
          }

          // Secondary
          const sId = parseInt(row[7], 10);
          const sGroupName = row[8]?.toString().trim();
          if (!isNaN(sId)) {
            const student = students.find(s => s.id === sId);
            if (student) {
              if (sGroupName) {
                const group = groups.find(g => g.stage === 'ثانوي' && g.name.toLowerCase() === sGroupName.toLowerCase());
                if (group) {
                  assignments.push({ studentId: sId, groupId: group.id });
                }
              }
            }
          }
        }

        if (assignments.length === 0) {
          pushToast('info', 'لم يتم العثور على أي تحديثات جديدة للمجموعات في الملف');
          setBusy(false);
          e.target.value = '';
          return;
        }

        const r = await fetch('/api/supervisor/students/bulk-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments })
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          pushToast('error', j.error ?? 'فشل التحديث الجماعي للمجموعات');
        } else {
          pushToast('success', `تم تحديث المجموعات لـ ${j.updatedCount} طالب بنجاح!`);
          load();
        }
      } catch (err) {
        console.error(err);
        pushToast('error', 'حدث خطأ أثناء قراءة ملف الإكسل');
      } finally {
        setBusy(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  }

  const activeGroup = isGlobal ? selectedGroupModal : groups[0] ?? null;

  const activeGroupStudents = useMemo(() => {
    if (!activeGroup) return [];
    return students.filter(s => s.groupId === activeGroup.id);
  }, [activeGroup, students]);

  const activeTotalPoints = useMemo(() => {
    if (!activeGroup) return 0;
    return getGroupPoints(activeGroup.id);
  }, [activeGroup, students, points]);

  const activeAvgPoints = useMemo(() => {
    return activeGroupStudents.length > 0 
      ? (activeGroupStudents.reduce((sum, s) => sum + getStudentPoints(s.id), 0) / activeGroupStudents.length).toFixed(1) 
      : '0';
  }, [activeGroupStudents, studentPointsMap]);

  const studentAvgPoints = useMemo(() => {
    const sumPoints = activeGroupStudents.reduce((sum, s) => sum + getStudentPoints(s.id), 0);
    return activeGroupStudents.length > 0 
      ? sumPoints / activeGroupStudents.length 
      : 0;
  }, [activeGroupStudents, studentPointsMap]);

  const activeTopStudent = useMemo(() => {
    if (activeGroupStudents.length === 0) return null;
    const sorted = [...activeGroupStudents].sort((a, b) => getStudentPoints(b.id) - getStudentPoints(a.id));
    return sorted[0];
  }, [activeGroupStudents, studentPointsMap]);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">المجموعات والأسر</h1>
          <p className="text-sm text-ink-500">تنظيم الطلاب في مجموعات لتسهيل الحضور ورصد النقاط.</p>
        </div>
        {canManageGroups && (
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => {
                setName('');
                setCheckedNewGroupStudentIds([]);
                setShowCreateGroupModal(true);
              }}
              className="btn btn-primary py-2 px-4 text-sm flex items-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>إنشاء مجموعة جديدة</span>
            </button>
            <button
              onClick={downloadTemplate}
              disabled={busy || loading}
              className="btn btn-secondary py-2 px-4 text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>تحميل القالب</span>
            </button>
            <label className={`btn btn-secondary py-2 px-4 text-sm flex items-center gap-2 cursor-pointer ${busy || loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span>رفع ملف الإكسل</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
                disabled={busy || loading}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {isGroupsSup && !canManageGroups ? (
        /* groups_supervisor: show their assigned group(s) directly */
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="card p-6 text-center text-ink-500">لم يتم إسنادك لأي مجموعة أو أسرة حالياً. يرجى التواصل مع الإدارة.</div>
          ) : (
            <>
              <div className="card p-6 bg-gradient-to-l from-cream-100/40 to-brand-50/20 border border-ink-150 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-brand" />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right" dir="rtl">
                  <div className="space-y-1.5">
                    <h2 className="text-base font-bold text-ink-900 truncate">{activeGroup?.name}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
                      <span className="pill pill-gray text-xs">{activeGroup?.stage}</span>
                      <span>•</span>
                      <span className="font-semibold">المشرفون: </span>
                      {supervisors.filter(sup => sup.groupIds && activeGroup && sup.groupIds.split(',').map(s => parseInt(s, 10)).includes(activeGroup.id)).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {supervisors.filter(sup => sup.groupIds && activeGroup && sup.groupIds.split(',').map(s => parseInt(s, 10)).includes(activeGroup.id)).map(sup => (
                            <span key={sup.id} className="bg-white border border-ink-200 text-ink-700 px-2 py-0.5 rounded-lg text-xs font-semibold">{sup.name}</span>
                          ))}
                        </div>
                      ) : <span className="text-ink-400">لا يوجد مشرفون</span>}
                    </div>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto text-center shrink-0 mt-3 md:mt-0">
                    <div className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 flex-1 md:flex-none min-w-[100px] shadow-sm">
                      <div className="text-[10px] text-ink-500 font-semibold mb-0.5">عدد الطلاب</div>
                      <div className="text-lg font-bold text-blue-600">{activeGroupStudents.length}</div>
                    </div>
                    <div className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 flex-1 md:flex-none min-w-[100px] shadow-sm">
                      <div className="text-[10px] text-ink-500 font-semibold mb-0.5">نقاط الأسرة</div>
                      <div className="text-lg font-bold text-green-600">{activeTotalPoints}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card p-6">
                <h3 className="text-base font-bold text-ink-900 flex items-center gap-2 border-b border-ink-100 pb-3 mb-4">
                  <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  <span>أعضاء الأسرة وأداؤهم ({activeGroupStudents.length} طلاب)</span>
                </h3>
                {activeGroupStudents.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeGroupStudents.map(st => {
                      const isExpanded = expandedStudentId === st.id;
                      const studentTotal = getStudentPoints(st.id);
                      const studentLogs = points.filter(p => p.registrationId === st.id);
                      const byCategory: Record<string, number> = {};
                      studentLogs.forEach(p => { byCategory[p.category] = (byCategory[p.category] || 0) + p.delta; });
                      let performanceCls = 'bg-ink-100 text-ink-700';
                      let performanceLabel = 'عادي';
                      if (studentTotal > studentAvgPoints * 1.2 && studentTotal > 0) { performanceCls = 'bg-green-155 text-green-700 font-bold'; performanceLabel = 'ممتاز 🔥'; }
                      else if (studentTotal < studentAvgPoints * 0.8 && studentAvgPoints > 0) { performanceCls = 'bg-red-50 text-red-700 font-bold'; performanceLabel = 'يحتاج تشجيع ⚠️'; }
                      return (
                        <div key={st.id} className="border border-ink-200 rounded-xl overflow-hidden bg-white shadow-sm">
                          <div onClick={() => setExpandedStudentId(isExpanded ? null : st.id)} className="text-sm px-4 py-3.5 flex justify-between items-center cursor-pointer hover:bg-cream-50/50 select-none">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <svg className={`w-3.5 h-3.5 text-ink-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                              <span className="font-semibold text-ink-900 flex-1">{st.studentName}</span>
                              <span className="text-[10px] text-ink-500 bg-cream-100 px-2 py-0.5 rounded font-mono shrink-0">{st.grade}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${performanceCls}`}>{performanceLabel}</span>
                            </div>
                            <span className="pill pill-green font-bold text-xs shrink-0 mr-2">{studentTotal} نقطة</span>
                          </div>
                          {isExpanded && (
                            <div className="px-4 py-3 bg-ink-50/40 border-t border-ink-150 text-xs space-y-2 text-right">
                              <div className="text-[11px] font-bold text-ink-500 mb-2">مصادر النقاط:</div>
                              <div className="grid grid-cols-3 gap-2">
                                {[{key:'behavior',label:'سلوك'},{key:'participation',label:'مشاركة'},{key:'activity',label:'نشاط'},{key:'other',label:'أخرى'}].map(cat => (
                                  <div key={cat.key} className="bg-white rounded-lg border border-ink-150 px-3 py-2 text-center">
                                    <div className="text-[10px] text-ink-400 mb-1">{cat.label}</div>
                                    <div className={`text-sm font-bold ${(byCategory[cat.key]||0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{byCategory[cat.key] ?? 0}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-ink-400 text-center py-6">لا يوجد طلاب مسجلين في هذه المجموعة حالياً.</p>
                )}
              </div>
            </>
          )}
        </div>
      ) : !canManageGroups ? (
        /* Read-only view for others, grouped by stage */
        <div className="space-y-6">
          {stages.map((stDef) => {
            const stageGroups = groups.filter((g) => g.stage === stDef.key);
            if (stageGroups.length === 0) return null;

            return (
              <div key={stDef.key} className="card p-6">
                <h2 className="text-lg font-bold text-ink-900 border-b border-ink-100 pb-3 mb-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                  <span>المرحلة {stDef.label} ({stageGroups.length} مجموعات)</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {stageGroups.map((g) => {
                    const studentCount = countOf(g.id);
                    const totalPoints = getGroupPoints(g.id);
                    const groupSups = supervisors.filter((sup) =>
                      sup.groupIds &&
                      sup.groupIds.split(',').map((s) => parseInt(s, 10)).includes(g.id)
                    );

                    return (
                      <div key={g.id} className="rounded-xl border border-ink-200 p-4 bg-white shadow-sm flex flex-col justify-between hover:shadow hover:border-brand/40 transition-all duration-200">
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2.5">
                            <h3 className="font-bold text-base text-ink-900 leading-snug">{g.name}</h3>
                            <span className="pill pill-gray text-[10px] whitespace-nowrap shrink-0">{g.stage}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mb-3 bg-cream-50/60 p-2.5 rounded-lg border border-ink-100/60 text-center">
                            <div>
                              <div className="text-[9px] text-ink-500 font-semibold mb-0.5">الطلاب</div>
                              <div className="text-sm font-bold text-blue-600 font-mono">{studentCount} طالب</div>
                            </div>
                            <div className="border-r border-ink-100/60">
                              <div className="text-[9px] text-ink-500 font-semibold mb-0.5">نقاط المجموعة</div>
                              <div className="text-sm font-bold text-green-600 font-mono">{totalPoints} ن</div>
                            </div>
                          </div>

                          <div className="text-xs text-ink-600 space-y-1 mb-4">
                            <span className="font-semibold block text-ink-500 text-[10px]">المشرفون:</span>
                            {groupSups.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {groupSups.map((sup) => (
                                  <span key={sup.id} className="bg-cream-100 border border-ink-200/50 text-ink-700 px-2 py-0.5 rounded-lg text-[10px] font-semibold">
                                    {sup.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-ink-400 text-[10px]">لا يوجد مشرفون مسجلون</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedGroupModal(g);
                            setShowAddStudents(false);
                            setCheckedAddStudentIds([]);
                            setExpandedStudentId(null);
                          }}
                          className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 w-full justify-center mt-auto hover:bg-cream-200 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>عرض الأعضاء والتفاصيل</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {groups.length === 0 && (
            <div className="card p-6 text-center text-ink-500">
              لا توجد مجموعات أو أسر حالياً لعرضها.
            </div>
          )}
        </div>
      ) : isGlobal || isStage ? (
        <div className="w-full">
          <div className="card p-6">
            {(() => {
              const displayGroups = isStage && supervisorStage
                ? groups.filter(g => g.stage === supervisorStage)
                : groups;
              return (
            <>
            <h2 className="text-lg font-bold text-ink-900 mb-4">
              {isStage ? `مجموعات مرحلة ${supervisorStage} (${displayGroups.length})` : `المجموعات (${groups.length})`}
            </h2>
            {loading ? (
              <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
            ) : displayGroups.length === 0 ? (
              <p className="text-center py-10 text-ink-400 text-sm">لا توجد مجموعات بعد.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {displayGroups.map((g) => (
                  <div key={g.id}
                       onClick={() => { setSelectedGroupModal(g); setShowAddStudents(false); setCheckedAddStudentIds([]); setExpandedStudentId(null); }}
                       className="cursor-pointer hover:border-brand transition-colors rounded-xl border border-ink-200 p-4 flex items-center justify-between bg-white shadow-sm hover:shadow">
                    <div>
                      <div className="font-semibold text-ink-900">{g.name}</div>
                      <div className="text-xs text-ink-400 mt-0.5">{g.stage}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right flex flex-col items-end gap-1 shrink-0">
                        <span className="pill pill-blue text-[11px] font-bold">{countOf(g.id)} طالب</span>
                        <span className="pill pill-green font-bold text-[11px]">{getGroupPoints(g.id)} نقطة</span>
                      </div>
                      {canManageGroups && (
                        <button onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }} className="text-red-500 hover:text-red-750 p-1 flex items-center justify-center shrink-0" title="حذف المجموعة">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>
            );
            })()}
          </div>
        </div>
      ) : (
        loading ? (
          <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
        ) : groups.length === 0 ? (
          <div className="card p-6 text-center text-ink-500">
            لم يتم إسنادك لأي مجموعة أو أسرة حالياً. يرجى التواصل مع الإدارة.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="card p-6 bg-gradient-to-l from-cream-100/40 to-brand-50/20 border border-ink-150 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1.5 h-full bg-brand" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right" dir="rtl">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-bold text-ink-900">{groups[0].name}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
                    <span className="pill pill-gray text-xs">{groups[0].stage}</span>
                    <span>•</span>
                    <span className="font-semibold">المشرفون: </span>
                    {supervisors.filter(sup => sup.groupIds && sup.groupIds.split(',').map(s => parseInt(s, 10)).includes(groups[0].id)).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {supervisors.filter(sup => sup.groupIds && sup.groupIds.split(',').map(s => parseInt(s, 10)).includes(groups[0].id)).map(sup => (
                          <span key={sup.id} className="bg-white border border-ink-200 text-ink-700 px-2 py-0.5 rounded-lg text-xs font-semibold">{sup.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-400">لا يوجد مشرفون مسجلون</span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-4 w-full md:w-auto text-center shrink-0 mt-3 md:mt-0">
                  <div className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 flex-1 md:flex-none min-w-[100px] shadow-sm">
                    <div className="text-[10px] text-ink-500 font-semibold mb-0.5">عدد الطلاب</div>
                    <div className="text-lg font-bold text-blue-600 font-mono">{activeGroupStudents.length}</div>
                  </div>
                  <div className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 flex-1 md:flex-none min-w-[100px] shadow-sm">
                    <div className="text-[10px] text-ink-500 font-semibold mb-0.5">نقاط المجموعة</div>
                    <div className="text-lg font-bold text-green-600 font-mono">{activeTotalPoints}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="font-body">
                <h3 className="text-lg font-bold text-ink-900 flex items-center gap-2 border-b border-ink-100 pb-3 mb-4">
                  <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  <span>أعضاء المجموعة وأداؤهم ({activeGroupStudents.length} طلاب)</span>
                </h3>

                {activeGroupStudents.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeGroupStudents.map(st => {
                      const isExpanded = expandedStudentId === st.id;
                      const studentLogs = points.filter(p => p.registrationId === st.id);
                      const studentTotal = getStudentPoints(st.id);

                      let performanceCls = "bg-ink-100 text-ink-700";
                      let performanceLabel = "عادي";
                      if (studentTotal > studentAvgPoints * 1.2 && studentTotal > 0) {
                        performanceCls = "bg-green-155 text-green-700 font-bold";
                        performanceLabel = "ممتاز 🔥";
                      } else if (studentTotal < studentAvgPoints * 0.8 && studentAvgPoints > 0) {
                        performanceCls = "bg-red-50 text-red-700 font-bold";
                        performanceLabel = "يحتاج تشجيع ⚠️";
                      }

                      return (
                        <div key={st.id} className="border border-ink-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow transition-shadow">
                          <div 
                            onClick={() => setExpandedStudentId(isExpanded ? null : st.id)}
                            className="text-sm px-4 py-3.5 flex justify-between items-center bg-white cursor-pointer hover:bg-cream-50/50 transition-colors select-none"
                            dir="rtl"
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <svg className={`w-3.5 h-3.5 text-ink-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                              <span className="font-semibold text-ink-900 flex-1">{st.studentName}</span>
                              <span className="text-[10px] text-ink-500 bg-cream-100 px-2 py-0.5 rounded font-mono shrink-0">{st.grade}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${performanceCls}`}>{performanceLabel}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="pill pill-green font-bold text-xs">{studentTotal} نقطة</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 py-3.5 bg-ink-50/30 border-t border-ink-150 text-xs space-y-2 text-right" dir="rtl">
                              <div className="text-[11px] font-bold text-ink-500 mb-1">تفاصيل ورصد النقاط:</div>
                              {studentLogs.length === 0 ? (
                                <p className="text-ink-400 text-center py-3 bg-white rounded-lg border border-ink-150">لا توجد نقاط مسجلة لهذا الطالب بعد.</p>
                              ) : (
                                <div className="divide-y divide-ink-150 max-h-56 overflow-y-auto scroll-soft bg-white rounded-lg border border-ink-150 px-3">
                                  {studentLogs.map((log) => (
                                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                                      <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-ink-800 truncate">{log.reason}</div>
                                        <div className="text-[10px] text-ink-400 flex gap-2 mt-0.5">
                                          <span>الفئة: {catLabel(log.category)}</span>
                                          <span>•</span>
                                          <span>بواسطة: {log.recordedBy || '—'}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] text-ink-400">{formatDate(log.createdAt)}</span>
                                        <span className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${log.delta >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-750'}`}>
                                          {log.delta >= 0 ? `+${log.delta}` : log.delta}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-ink-400 text-center py-6">لا يوجد طلاب مسجلين في هذه المجموعة حالياً.</p>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* قسم الطلاب غير المعينين في أسرة */}
      {canManageGroups && (
        <div className="card p-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900">طلاب غير مسجلين في أسرة ({unassignedStudents.length})</h2>
              <p className="text-xs text-ink-500 mt-0.5">يمكنك إسناد الطلاب إلى الأسر المتاحة يدوياً.</p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                className="field py-1.5 px-3 text-sm flex-1 sm:w-60"
                placeholder="ابحث عن اسم الطالب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="field py-1.5 px-3 text-sm sm:w-32"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="">كل المراحل</option>
                {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
          ) : filteredUnassigned.length === 0 ? (
            <p className="text-center py-10 text-brand-600 text-sm font-semibold">
              {searchQuery || stageFilter ? 'لا يوجد طلاب يطابقون خيارات البحث.' : 'جميع الطلاب مسجلون في أسر حالياً! 🎉'}
            </p>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto scroll-soft">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>اسم الطالب</th>
                      <th>المرحلة الدراسية</th>
                      <th>الصف</th>
                      <th className="w-64">الأسرة المناسبة</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnassigned.map((student) => {
                      const studentGroups = groups.filter(g => g.stage === student.stage);
                      const selectedGId = selectedGroups[student.id] || '';
                      return (
                        <tr key={student.id}>
                          <td className="font-semibold text-ink-900">{student.studentName}</td>
                          <td>
                            <span className="pill pill-gray">{student.stage}</span>
                          </td>
                          <td className="text-ink-500 text-sm">{student.grade}</td>
                          <td>
                            {studentGroups.length === 0 ? (
                              <span className="text-xs text-ink-400">لا توجد أسر لهذه المرحلة بعد</span>
                            ) : (
                              <select
                                className="field py-1 px-2 text-xs"
                                value={selectedGId}
                                onChange={(e) => setSelectedGroups(prev => ({ ...prev, [student.id]: parseInt(e.target.value, 10) }))}
                              >
                                <option value="">اختر أسرة...</option>
                                {studentGroups.map(g => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => assignGroup(student.id, selectedGId as number)}
                              disabled={!selectedGId || busy}
                              className="btn btn-primary py-1 px-3 text-xs w-full text-center"
                            >
                              إسناد
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <ul className="md:hidden divide-y divide-ink-200">
                {filteredUnassigned.map((student) => {
                  const studentGroups = groups.filter(g => g.stage === student.stage);
                  const selectedGId = selectedGroups[student.id] || '';
                  return (
                    <li key={student.id} className="py-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink-900">{student.studentName}</span>
                        <span className="pill pill-gray text-xs">{student.stage}</span>
                      </div>
                      <div className="text-xs text-ink-500">الصف الدراسي: {student.grade}</div>
                      
                      <div className="flex gap-2">
                        <div className="flex-1">
                          {studentGroups.length === 0 ? (
                            <span className="text-xs text-ink-400 block pt-2">لا توجد أسر لهذه المرحلة بعد</span>
                          ) : (
                            <select
                              className="field py-1.5 px-2 text-xs"
                              value={selectedGId}
                              onChange={(e) => setSelectedGroups(prev => ({ ...prev, [student.id]: parseInt(e.target.value, 10) }))}
                            >
                              <option value="">اختر أسرة...</option>
                              {studentGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <button
                          onClick={() => assignGroup(student.id, selectedGId as number)}
                          disabled={!selectedGId || busy}
                          className="btn btn-primary py-1.5 px-4 text-xs shrink-0"
                        >
                          إسناد
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {/* نافذة إنشاء مجموعة جديدة */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-right" dir="rtl">
            <div className="p-5 border-b border-ink-200 flex justify-between items-center bg-ink-50">
              <h3 className="text-lg font-bold text-ink-900">إنشاء مجموعة جديدة</h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-ink-400 hover:text-ink-900 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={create} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="label font-semibold">اسم المجموعة</label>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أسرة النخبة" />
              </div>
              <div>
                <label className="label font-semibold">المرحلة</label>
                <select className="field" value={stage} onChange={(e) => {
                  setStage(e.target.value);
                  setCheckedNewGroupStudentIds([]);
                }}>
                  {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              
              {/* Checklist of unassigned students of selected stage */}
              <div className="space-y-2">
                <label className="label font-bold">تحديد طلاب المجموعة (غير مسجلين في أسرة):</label>
                {students.filter(s => s.groupId === null && s.stage === stage).length === 0 ? (
                  <p className="text-xs text-ink-400 py-3 bg-cream-50 rounded-lg border border-line text-center">لا يوجد طلاب غير معينين في هذه المرحلة.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto scroll-soft border border-ink-200 rounded-xl p-3 bg-cream-50/20">
                    {students.filter(s => s.groupId === null && s.stage === stage).map(st => (
                      <label key={st.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-ink-200 bg-white hover:bg-cream-50 transition-colors select-none text-xs">
                        <input
                          type="checkbox"
                          checked={checkedNewGroupStudentIds.includes(st.id)}
                          onChange={() => {
                            setCheckedNewGroupStudentIds(prev =>
                              prev.includes(st.id) ? prev.filter(id => id !== st.id) : [...prev, st.id]
                            );
                          }}
                          className="rounded text-brand w-4 h-4 cursor-pointer focus:ring-brand"
                        />
                        <span className="font-semibold text-ink-900">{st.studentName} ({st.grade})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={busy} className="btn btn-primary flex-1 font-bold">
                  {busy ? '...' : `إنشاء المجموعة المحددة (${checkedNewGroupStudentIds.length} طالب)`}
                </button>
                <button type="button" onClick={() => setShowCreateGroupModal(false)} className="btn btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل المجموعة */}
      {selectedGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-right" dir="rtl">
            
            {/* الجزء العلوي: اسم المجموعة وتفاصيلها بالكامل */}
            <div className="p-5 border-b border-ink-200 bg-ink-50">
              <div className="flex justify-between items-start">
                <div className="space-y-1 min-w-0">
                  <h3 className="text-base font-bold text-ink-900 truncate">{selectedGroupModal.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
                    <span className="pill pill-gray text-xs">{selectedGroupModal.stage}</span>
                    <span>•</span>
                    <span className="font-semibold">المشرفون: </span>
                    {supervisors.filter(sup => sup.groupIds && sup.groupIds.split(',').map(s => parseInt(s, 10)).includes(selectedGroupModal.id)).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {supervisors.filter(sup => sup.groupIds && sup.groupIds.split(',').map(s => parseInt(s, 10)).includes(selectedGroupModal.id)).map(sup => (
                          <span key={sup.id} className="bg-cream-100 text-ink-700 px-2 py-0.5 rounded-lg text-xs font-semibold">{sup.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-400">لا يوجد مشرفون معينون</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedGroupModal(null)} className="text-ink-400 hover:text-ink-900 font-bold p-1 flex items-center justify-center rounded-lg hover:bg-ink-150 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* ملخص نقاط المجموعة تفصيلياً */}
              <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-ink-200 text-center mt-4 shadow-sm">
                <div className="space-y-1">
                  <div className="text-[11px] text-ink-500 font-semibold">إجمالي نقاط الأسرة</div>
                  <div className="text-lg font-extrabold text-green-600 font-mono">{activeTotalPoints}</div>
                </div>
                <div className="border-r border-ink-150 space-y-1">
                  <div className="text-[11px] text-ink-500 font-semibold">الطالب المتصدر</div>
                  <div className="text-xs font-bold text-ink-900 truncate px-1" title={activeTopStudent ? activeTopStudent.studentName : '—'}>
                    {activeTopStudent ? activeTopStudent.studentName : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* الجزء السفلي: طلاب المجموعة وتفاصيل نقاطهم */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="font-body">
              <h4 className="font-bold text-ink-900 flex items-center gap-2 border-b border-ink-100 pb-2">
                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span>أعضاء المجموعة وأداؤهم ({activeGroupStudents.length} طلاب)</span>
              </h4>

              {activeGroupStudents.length > 0 ? (
                <div className="space-y-2.5">
                  {activeGroupStudents.map(st => {
                    const isExpanded = expandedStudentId === st.id;
                    const studentLogs = points.filter(p => p.registrationId === st.id);
                    const studentTotal = getStudentPoints(st.id);

                    // تصنيف الأداء مقارنة بمتوسط المجموعة
                    let performanceCls = "bg-ink-100 text-ink-700";
                    let performanceLabel = "عادي";
                    if (studentTotal > studentAvgPoints * 1.2 && studentTotal > 0) {
                      performanceCls = "bg-green-155 text-green-700 font-bold";
                      performanceLabel = "ممتاز 🔥";
                    } else if (studentTotal < studentAvgPoints * 0.8 && studentAvgPoints > 0) {
                      performanceCls = "bg-red-50 text-red-700 font-bold";
                      performanceLabel = "يحتاج تشجيع ⚠️";
                    }

                    return (
                      <div key={st.id} className="border border-ink-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow transition-shadow">
                        {/* Row Header */}
                        <div 
                          onClick={() => setExpandedStudentId(isExpanded ? null : st.id)}
                          className="text-sm px-4 py-3 flex justify-between items-center bg-white cursor-pointer hover:bg-cream-50/50 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <svg className={`w-3.5 h-3.5 text-ink-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                            <span className="font-semibold text-ink-900 flex-1">{st.studentName}</span>
                            <span className="text-[10px] text-ink-500 bg-cream-100 px-2 py-0.5 rounded font-mono shrink-0">{st.grade}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${performanceCls}`}>{performanceLabel}</span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="pill pill-green font-bold text-xs">{studentTotal} نقطة</span>
                            {canManageGroups && (
                              <button
                                onClick={() => removeStudentFromGroup(st.id)}
                                disabled={busy}
                                className="text-red-500 hover:text-red-750 hover:bg-red-50 w-7 h-7 flex items-center justify-center rounded-full font-bold transition-all shrink-0"
                                title="إزالة من المجموعة"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Accordion Body - category summary */}
                        {isExpanded && (() => {
                          const byCategory: Record<string, number> = {};
                          studentLogs.forEach(p => { byCategory[p.category] = (byCategory[p.category] || 0) + p.delta; });
                          return (
                            <div className="px-4 py-3 bg-ink-50/40 border-t border-ink-150 text-xs">
                              <div className="text-[11px] font-bold text-ink-500 mb-2">مصادر النقاط:</div>
                              {studentLogs.length === 0 ? (
                                <p className="text-ink-400 text-center py-2">لا توجد نقاط مسجلة بعد.</p>
                              ) : (
                                <div className="grid grid-cols-4 gap-2">
                                  {[{key:'behavior',label:'سلوك'},{key:'participation',label:'مشاركة'},{key:'activity',label:'نشاط'},{key:'other',label:'أخرى'}].map(cat => (
                                    <div key={cat.key} className="bg-white rounded-lg border border-ink-150 px-2 py-2 text-center">
                                      <div className="text-[9px] text-ink-400 mb-1">{cat.label}</div>
                                      <div className={`text-sm font-bold ${(byCategory[cat.key]||0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{byCategory[cat.key] ?? 0}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink-400 text-center py-6">لا يوجد طلاب مسجلين في هذه المجموعة حالياً.</p>
              )}

                {/* Checklist to add new students to group */}
                {canManageGroups && (
                  <div className="border-t border-ink-100 pt-4 mt-5">
                    {!showAddStudents ? (
                      <button
                        onClick={() => {
                          setShowAddStudents(true);
                          setCheckedAddStudentIds([]);
                        }}
                        className="btn btn-secondary py-1.5 px-4 text-xs font-semibold flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>إضافة طلاب للمجموعة</span>
                      </button>
                    ) : (
                      <div className="space-y-3 bg-cream-50/50 p-4 rounded-xl border border-line">
                        <div className="flex justify-between items-center">
                          <h5 className="text-xs font-bold text-ink-800">إضافة طلاب جدد للمجموعة (طلاب مرحلة {selectedGroupModal.stage}):</h5>
                          <button
                            onClick={() => setShowAddStudents(false)}
                            className="text-ink-400 hover:text-ink-900 text-xs font-bold flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                            <span>إلغاء</span>
                          </button>
                        </div>
                        
                        {students.filter(s => s.groupId === null && s.stage === selectedGroupModal.stage).length === 0 ? (
                          <p className="text-xs text-ink-400 py-2">لا يوجد طلاب غير مضافين لمجموعات في هذه المرحلة.</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto scroll-soft p-1">
                              {students.filter(s => s.groupId === null && s.stage === selectedGroupModal.stage).map(st => (
                                <label key={st.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-ink-200 bg-white hover:bg-cream-50 transition-colors select-none text-xs">
                                  <input
                                    type="checkbox"
                                    checked={checkedAddStudentIds.includes(st.id)}
                                    onChange={() => {
                                      setCheckedAddStudentIds(prev =>
                                        prev.includes(st.id) ? prev.filter(id => id !== st.id) : [...prev, st.id]
                                      );
                                    }}
                                    className="rounded text-brand w-4 h-4 cursor-pointer focus:ring-brand"
                                  />
                                  <span className="font-semibold text-ink-900">{st.studentName} ({st.grade})</span>
                                </label>
                              ))}
                            </div>
                            
                            <button
                              onClick={handleAddStudentsSubmit}
                              disabled={checkedAddStudentIds.length === 0 || busy}
                              className="btn btn-primary py-1.5 px-4 text-xs font-bold w-full justify-center"
                            >
                              {busy ? 'جاري الإضافة...' : `إضافة الطلاب المحددين (${checkedAddStudentIds.length})`}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
