'use client';

import { useEffect, useMemo, useState } from 'react';
import { pushToast } from '@/components/Toast';

type Student = { id: number; membershipNo: number; studentName: string; groupId: number | null };
type Group = { id: number; name: string };
type Point = {
  id: number; registrationId: number; delta: number; reason: string;
  category: string; recordedBy: string | null; createdAt: string;
};

const CATEGORIES = [
  { key: 'behavior', label: 'سلوك' },
  { key: 'participation', label: 'مشاركة' },
  { key: 'activity', label: 'نشاط' },
  { key: 'other', label: 'أخرى' }
];
const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k;

export default function PointsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const [studentId, setStudentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('5');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('behavior');
  const [busy, setBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'history'>('leaderboard');
  const [leaderboardSearch, setLeaderboardSearch] = useState('');

  async function loadAll() {
    const [sr, gr, pr] = await Promise.all([
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/points', { cache: 'no-store' })
    ]);
    setStudents((await sr.json().catch(() => ({ students: [] }))).students ?? []);
    setGroups((await gr.json().catch(() => ({ groups: [] }))).groups ?? []);
    setPoints((await pr.json().catch(() => ({ points: [] }))).points ?? []);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  const nameOf = useMemo(() => {
    const m = new Map(students.map((s) => [s.id, s.studentName]));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [students]);

  const leaderboard = useMemo(() => {
    const pointsMap = new Map<number, number>();
    points.forEach((p) => {
      pointsMap.set(p.registrationId, (pointsMap.get(p.registrationId) ?? 0) + p.delta);
    });

    const list = students.map((s) => {
      const total = pointsMap.get(s.id) ?? 0;
      const groupName = s.groupId ? groups.find((g) => g.id === s.groupId)?.name : '—';
      return {
        ...s,
        totalPoints: total,
        groupName
      };
    });

    list.sort((a, b) => b.totalPoints - a.totalPoints);
    return list;
  }, [students, points, groups]);

  const filteredLeaderboard = useMemo(() => {
    return leaderboard.filter((item) =>
      item.studentName.toLowerCase().includes(leaderboardSearch.trim().toLowerCase())
    );
  }, [leaderboard, leaderboardSearch]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const delta = sign * Math.abs(parseInt(amount, 10) || 0);
    if (!delta || !reason.trim()) return pushToast('error', 'أدخل عدد النقاط والسبب');
    if (mode === 'individual' && !studentId) return pushToast('error', 'اختر الطالب');
    if (mode === 'group' && !groupId) return pushToast('error', 'اختر المجموعة');

    setBusy(true);
    const r = await fetch('/api/supervisor/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: mode === 'individual' ? studentId : undefined,
        groupId: mode === 'group' ? groupId : undefined,
        delta, reason: reason.trim(), category
      })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل تسجيل النقاط');
    pushToast('success', j.bulk ? `تم رصد النقاط لـ ${j.pointRecords.length} طالب` : 'تم رصد النقاط');
    setReason('');
    loadAll();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">رصد النقاط</h1>
        <p className="text-sm text-ink-500">امنح أو اخصم نقاطاً لطالب أو لمجموعة كاملة.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form onSubmit={submit} className="card p-6 space-y-4 lg:col-span-1 self-start">
          <div className="flex gap-2">
            <button type="button" className={`choice flex-1 ${mode === 'individual' ? 'is-active' : ''}`} onClick={() => setMode('individual')}>طالب</button>
            <button type="button" className={`choice flex-1 ${mode === 'group' ? 'is-active' : ''}`} onClick={() => setMode('group')}>مجموعة</button>
          </div>

          {mode === 'individual' ? (
            <div>
              <label className="label">الطالب</label>
              <select className="field" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">اختر الطالب</option>
                {students.map((s) => <option key={s.id} value={String(s.id)}>{s.studentName} (#{s.membershipNo})</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">المجموعة / الأسرة</label>
              <select className="field" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">اختر المجموعة</option>
                {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">النوع</label>
            <div className="flex gap-2">
              <button type="button" className={`choice flex-1 ${sign === 1 ? 'is-active' : ''}`} onClick={() => setSign(1)}>+ إضافة</button>
              <button type="button" className={`choice flex-1 ${sign === -1 ? 'is-active' : ''}`} onClick={() => setSign(-1)}>− خصم</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">عدد النقاط</label>
              <input className="field" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">السبب</label>
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تميّز في النشاط" />
          </div>

          <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? '...' : 'رصد النقاط'}</button>
        </form>

        <div className="card p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-ink-200 pb-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`choice py-1.5 px-4 text-sm ${activeTab === 'leaderboard' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('leaderboard')}
              >
                🏆 ترتيب الصدارة
              </button>
              <button
                type="button"
                className={`choice py-1.5 px-4 text-sm ${activeTab === 'history' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                📜 سجل رصد النقاط
              </button>
            </div>
            
            {activeTab === 'leaderboard' && (
              <input
                type="text"
                placeholder="ابحث عن اسم طالب..."
                className="field py-1 px-3 text-xs sm:w-48"
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
              />
            )}
          </div>

          {loading ? (
            <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
          ) : activeTab === 'leaderboard' ? (
            filteredLeaderboard.length === 0 ? (
              <p className="text-center py-10 text-ink-400 text-sm">لا يوجد طلاب تطابق خيارات البحث.</p>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto scroll-soft">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>الترتيب</th>
                        <th>الطالب</th>
                        <th>رقم العضوية</th>
                        <th>الأسرة / المجموعة</th>
                        <th>إجمالي النقاط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeaderboard.map((item) => {
                        const rank = leaderboard.findIndex((x) => x.id === item.id) + 1;
                        let rankBadge;
                        if (rank === 1) rankBadge = <span className="text-xl">🥇</span>;
                        else if (rank === 2) rankBadge = <span className="text-xl">🥈</span>;
                        else if (rank === 3) rankBadge = <span className="text-xl">🥉</span>;
                        else rankBadge = <span className="text-ink-400 font-mono">#{rank}</span>;

                        return (
                          <tr key={item.id}>
                            <td>{rankBadge}</td>
                            <td className="font-semibold text-ink-900">{item.studentName}</td>
                            <td className="font-mono text-ink-500 text-sm">#{item.membershipNo}</td>
                            <td className="text-ink-600 text-sm">{item.groupName}</td>
                            <td>
                              <span className={`pill ${item.totalPoints >= 0 ? 'pill-green' : 'pill-red'} font-bold`}>
                                {item.totalPoints} نقطة
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="lg:hidden divide-y divide-ink-200">
                  {filteredLeaderboard.map((item) => {
                    const rank = leaderboard.findIndex((x) => x.id === item.id) + 1;
                    let rankBadge;
                    if (rank === 1) rankBadge = <span className="text-lg">🥇</span>;
                    else if (rank === 2) rankBadge = <span className="text-lg">🥈</span>;
                    else if (rank === 3) rankBadge = <span className="text-lg">🥉</span>;
                    else rankBadge = <span className="text-ink-400 font-mono text-xs">#{rank}</span>;

                    return (
                      <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-8 text-center">{rankBadge}</div>
                          <div className="min-w-0">
                            <div className="font-semibold text-ink-900 truncate">{item.studentName}</div>
                            <div className="text-xs text-ink-400 mt-0.5">العضوية: #{item.membershipNo} · الأسرة: {item.groupName}</div>
                          </div>
                        </div>
                        <span className={`pill shrink-0 ${item.totalPoints >= 0 ? 'pill-green' : 'pill-red'} font-bold`}>
                          {item.totalPoints} ن
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )
          ) : points.length === 0 ? (
            <p className="text-center py-10 text-ink-400 text-sm">لا توجد نقاط مرصودة بعد.</p>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto scroll-soft">
                <table className="tbl">
                  <thead>
                    <tr><th>الطالب</th><th>النقاط</th><th>التصنيف</th><th>السبب</th><th>بواسطة</th></tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{nameOf(p.registrationId)}</td>
                        <td>
                          <span className={`pill ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`} dir="ltr">
                            {p.delta >= 0 ? `+${p.delta}` : p.delta}
                          </span>
                        </td>
                        <td className="text-ink-500 text-sm">{catLabel(p.category)}</td>
                        <td className="text-ink-700 text-sm">{p.reason}</td>
                        <td className="text-ink-400 text-sm">{p.recordedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="lg:hidden divide-y divide-ink-200">
                {points.map((p) => (
                  <li key={p.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink-900 truncate">{nameOf(p.registrationId)}</div>
                      <div className="text-sm text-ink-700 mt-0.5">{p.reason}</div>
                      <div className="text-xs text-ink-400 mt-0.5">{catLabel(p.category)} · {p.recordedBy || '—'}</div>
                    </div>
                    <span className={`pill shrink-0 ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`} dir="ltr">
                      {p.delta >= 0 ? `+${p.delta}` : p.delta}
                    </span>
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
