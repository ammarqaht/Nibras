'use client';

import { useEffect, useMemo, useState } from 'react';
import { stages } from '@/content';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Group = { id: number; name: string; stage: string };
type Student = { id: number; studentName: string; stage: string; grade: string; groupId: number | null; registrationStatus: string };

export default function GroupsPage() {
  const { user } = useSupervisor();
  const isAdmin = user?.role === 'admin';

  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [stage, setStage] = useState<string>(stages[0].key);
  const [busy, setBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Record<number, number>>({});

  async function load() {
    const [gr, sr] = await Promise.all([
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/students', { cache: 'no-store' })
    ]);
    const grj = await gr.json().catch(() => ({ groups: [] }));
    const srj = await sr.json().catch(() => ({ students: [] }));
    setGroups(grj.groups ?? []);
    const allSt: Student[] = srj.students ?? [];
    setStudents(allSt.filter((s) => s.registrationStatus === 'approved'));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const countOf = useMemo(() => {
    const m = new Map<number, number>();
    students.forEach((s) => { if (s.groupId != null) m.set(s.groupId, (m.get(s.groupId) ?? 0) + 1); });
    return (id: number) => m.get(id) ?? 0;
  }, [students]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return pushToast('error', 'أدخل اسم المجموعة');
    setBusy(true);
    const r = await fetch('/api/supervisor/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), stage })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    pushToast('success', 'تم إنشاء المجموعة');
    setName('');
    load();
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

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">المجموعات والأسر</h1>
          <p className="text-sm text-ink-500">تنظيم الطلاب في مجموعات لتسهيل الحضور ورصد النقاط.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={downloadTemplate}
              disabled={busy || loading}
              className="btn btn-secondary py-2 px-4 text-sm flex items-center gap-2"
            >
              📥 تحميل القالب
            </button>
            <label className={`btn btn-primary py-2 px-4 text-sm flex items-center gap-2 cursor-pointer ${busy || loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              📤 رفع ملف الإكسل
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {isAdmin && (
          <form onSubmit={create} className="card p-6 space-y-4 self-start">
            <h2 className="text-lg font-bold text-ink-900">إنشاء مجموعة</h2>
            <div>
              <label className="label">اسم المجموعة</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أسرة النخبة" />
            </div>
            <div>
              <label className="label">المرحلة</label>
              <select className="field" value={stage} onChange={(e) => setStage(e.target.value)}>
                {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? '...' : 'إنشاء'}</button>
          </form>
        )}

        <div className={`card p-6 ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <h2 className="text-lg font-bold text-ink-900 mb-4">المجموعات ({groups.length})</h2>
          {loading ? (
            <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
          ) : groups.length === 0 ? (
            <p className="text-center py-10 text-ink-400 text-sm">لا توجد مجموعات بعد.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g) => (
                <div key={g.id} className="rounded-xl border border-ink-200 p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-ink-900">{g.name}</div>
                    <div className="text-xs text-ink-400 mt-0.5">{g.stage}</div>
                  </div>
                  <span className="pill pill-blue">{countOf(g.id)} طالب</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* قسم الطلاب غير المعينين في أسرة */}
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
    </div>
  );
}
