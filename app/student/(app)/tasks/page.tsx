'use client';

import { useEffect, useRef, useState } from 'react';

type TaskItem = {
  task: {
    id: string;
    title: string;
    description: string;
    maxPoints: number;
    dueDate: string;
    startDate: string | null;
    track: string | null;
    cost?: number;
    durationHours?: number | null;
    submissionMethod: string;
    resourceLink: string | null;
    imageUrl: string | null;
  };
  submission: {
    id: string;
    status: string;
    grade: number | null;
    feedback: string | null;
    fileUrl: string;
    claimedAt?: string | null;
    submittedAt: string;
  } | null;
};

// Remaining time (ms) for a claimed task, or null if no time limit
function claimDeadline(item: TaskItem): number | null {
  const dur = item.task.durationHours;
  const claimedAt = item.submission?.claimedAt;
  if (!dur || dur <= 0 || !claimedAt) return null;
  return new Date(claimedAt).getTime() + dur * 3600000;
}
function fmtRemaining(ms: number): string {
  if (ms <= 0) return 'انتهى الوقت';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d} يوم ${h % 24} ساعة`; }
  if (h > 0) return `${h} ساعة ${m} دقيقة`;
  return `${m} دقيقة`;
}

// Map legacy Arabic values + new keys to a canonical method key
function methodKey(m: string): string {
  switch (m) {
    case 'file': case 'رفع ملف': case 'image': case 'video': case 'any': return 'file';
    case 'audio': return 'audio';
    case 'text': return 'text';
    case 'ack': case 'إقرار بالإنجاز': return 'ack';
    default: return 'file';
  }
}

const METHOD_LABELS: Record<string, string> = {
  file: 'رفع ملف',
  audio: 'تسجيل صوتي',
  text: 'إجابة نصية',
  ack: 'إقرار بالإنجاز',
};

// Consistent color per track (category) — hashed into a fixed palette
const TRACK_PALETTE = [
  { from: '#34D399', to: '#059669', solid: '#047857', soft: '#E7F6EC' },
  { from: '#FBBF24', to: '#D97706', solid: '#B45309', soft: '#FEF3C7' },
  { from: '#A78BFA', to: '#7C3AED', solid: '#6D28D9', soft: '#EDE9FE' },
  { from: '#22D3EE', to: '#0891B2', solid: '#0E7490', soft: '#E0F7FA' },
  { from: '#F472B6', to: '#DB2777', solid: '#BE185D', soft: '#FCE7F3' },
  { from: '#60A5FA', to: '#2563EB', solid: '#1D4ED8', soft: '#E0ECFF' },
];
function trackColor(track: string | null) {
  const t = track || 'عام';
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return TRACK_PALETTE[h % TRACK_PALETTE.length];
}

function statusRank(s: TaskItem) {
  const st = s.submission?.status;
  if (st === 'claimed' || st === 'rejected') return 0; // active — needs the student's action → first
  if (!st || st === 'cancelled' || st === 'expired') return 1; // claimable
  if (st === 'pending') return 2; // awaiting review
  return 3; // approved → last
}

export default function StudentTasks() {
  const [items, setItems] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [actionBusy, setActionBusy] = useState(false);

  // Submission form state
  const [subText, setSubText] = useState('');
  const [subFile, setSubFile] = useState<File | null>(null);
  const [subFileDataUrl, setSubFileDataUrl] = useState('');
  const [ackChecked, setAckChecked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subErr, setSubErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // List controls + submitted popup
  const [filterTrack, setFilterTrack] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [sortBy, setSortBy] = useState<'due' | 'points-desc' | 'points-asc'>('due');
  const [showSubmitted, setShowSubmitted] = useState(false);
  const [showActive, setShowActive] = useState(false);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/student/tasks')
      .then(r => r.json())
      .then(d => setItems(d.tasks || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Live tick so claim countdowns update on screen
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  async function refresh(keepTaskId?: string) {
    const d = await fetch('/api/student/tasks').then(r => r.json()).catch(() => ({ tasks: [] }));
    const list: TaskItem[] = d.tasks || [];
    setItems(list);
    if (keepTaskId) setSelected(list.find(i => i.task.id === keepTaskId) || null);
  }

  async function claimTaskReq(item: TaskItem) {
    setActionBusy(true); setSubErr('');
    try {
      const r = await fetch('/api/student/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', taskId: item.task.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setSubErr(j.error || 'تعذّر طلب المهمة'); return; }
      await refresh(item.task.id);
    } finally { setActionBusy(false); }
  }

  async function cancelTaskReq(item: TaskItem, reselect = true) {
    if (!window.confirm('إلغاء المهمة؟ سيُعاد إليك نصف المبلغ فقط.')) return;
    setActionBusy(true); setSubErr('');
    try {
      const r = await fetch('/api/student/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', taskId: item.task.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setSubErr(j.error || 'تعذّر الإلغاء'); return; }
      await refresh(reselect ? item.task.id : undefined);
    } finally { setActionBusy(false); }
  }

  function openTask(item: TaskItem) {
    setSelected(item);
    setSubText('');
    setSubFile(null);
    setSubFileDataUrl('');
    setAckChecked(false);
    setRecording(false);
    setSubErr('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSubFile(f);
    const reader = new FileReader();
    reader.onload = ev => setSubFileDataUrl(ev.target?.result as string || '');
    reader.readAsDataURL(f);
  }

  async function startRecording() {
    setSubErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = ev => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = ev => setSubFileDataUrl((ev.target?.result as string) || '');
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setSubErr('تعذّر الوصول إلى الميكروفون — يمكنك رفع ملف صوتي بدلاً من ذلك.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function submitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setSubErr('');

    let fileUrl = '';
    const method = methodKey(selected.task.submissionMethod);

    if (method === 'text') {
      if (!subText.trim()) { setSubErr('الرجاء كتابة النص'); setSubmitting(false); return; }
      fileUrl = 'text:' + subText.trim();
    } else if (method === 'ack') {
      if (!ackChecked) { setSubErr('الرجاء تأكيد الإقرار بالإنجاز'); setSubmitting(false); return; }
      fileUrl = 'ack://confirmed';
    } else {
      // file or audio — both produce a data URL
      if (!subFileDataUrl) { setSubErr(method === 'audio' ? 'الرجاء تسجيل أو رفع ملف صوتي' : 'الرجاء اختيار الملف'); setSubmitting(false); return; }
      fileUrl = subFileDataUrl;
    }

    try {
      const r = await fetch('/api/student/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: selected.task.id, fileUrl }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setSubErr(j.error || 'فشل التسليم'); setSubmitting(false); return; }
      await refresh(selected.task.id);
      setSubmitting(false);
    } catch {
      setSubErr('تعذّر الاتصال بالخادم');
      setSubmitting(false);
    }
  }

  const tracks = Array.from(new Set(items.map(i => i.task.track).filter(Boolean))) as string[];
  const methodsAvail = Array.from(new Set(items.map(i => methodKey(i.task.submissionMethod))));

  const visible = items.filter(i =>
    (!filterTrack || i.task.track === filterTrack) &&
    (!filterMethod || methodKey(i.task.submissionMethod) === filterMethod)
  );
  const sorted = [...visible].sort((a, b) => {
    if (sortBy === 'points-desc') return b.task.maxPoints - a.task.maxPoints;
    if (sortBy === 'points-asc') return a.task.maxPoints - b.task.maxPoints;
    return statusRank(a) - statusRank(b) || +new Date(a.task.dueDate) - +new Date(b.task.dueDate);
  });

  const activeClaimCount = items.filter(i => i.submission && ['claimed', 'pending', 'rejected'].includes(i.submission.status)).length;
  const atLimit = activeClaimCount >= 3;
  // Only the deposit of a not-yet-submitted (claimed) task is "locked"
  const lockedPoints = items.filter(i => i.submission?.status === 'claimed').reduce((a, i) => a + (i.task.cost ?? 0), 0);
  const earnedPoints = items.filter(i => i.submission?.status === 'approved').reduce((a, i) => a + (i.submission!.grade || 0), 0);
  const submittedItems = items
    .filter(i => i.submission && ['pending', 'approved', 'rejected'].includes(i.submission.status))
    .sort((a, b) => +new Date(b.submission!.submittedAt) - +new Date(a.submission!.submittedAt));
  const notSubmittedItems = items.filter(i => i.submission && ['expired', 'cancelled'].includes(i.submission.status));
  const claimedItems = items.filter(i => i.submission?.status === 'claimed');
  const trackTotals: Record<string, number> = {};
  for (const i of items) if (i.submission?.status === 'approved') { const t = i.task.track || 'عام'; trackTotals[t] = (trackTotals[t] || 0) + (i.submission.grade || 0); }
  const trackRows = Object.entries(trackTotals).map(([track, pts]) => ({ track, pts })).sort((a, b) => b.pts - a.pts);
  const maxTrackPts = Math.max(1, ...trackRows.map(r => r.pts));
  const motivational = earnedPoints > 0 ? 'استمر في التألق — إنجازاتك تتراكم! 🌟' : 'ابدأ أول مهمة الآن واكسب نقاطك! 🚀';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-5 space-y-4">
        {/* Program intro / stats hero — matches the navy hero on other pages */}
        <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: 'radial-gradient(circle at 80% 10%, rgba(255,159,28,0.12) 0%, transparent 50%), radial-gradient(circle at 20% 90%, rgba(18,179,213,0.15) 0%, transparent 60%), linear-gradient(135deg, #103F91 0%, #071F4A 100%)' }}>
          <div className="relative">
            <h1 className="font-display text-2xl font-bold">برنامج المهام</h1>
            <p className="text-sm opacity-90 mt-1 leading-relaxed">اطلب المهمة، أنجزها في وقتها، واكسب نقاطك. {motivational}</p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {([
                { label: atLimit ? 'بلغت الحد (٣)' : 'مهام مستلَمة', value: `${activeClaimCount}/3`, icon: '📥', onClick: () => setShowActive(true) },
                { label: 'نقاط محبوسة', value: lockedPoints, icon: '🔒' },
                { label: 'نقاط مكتسبة', value: earnedPoints, icon: '🏆' },
              ] as { label: string; value: string | number; icon: string; onClick?: () => void }[]).map(s => (
                <div key={s.label} onClick={s.onClick} role={s.onClick ? 'button' : undefined} tabIndex={s.onClick ? 0 : undefined}
                  onKeyDown={s.onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') s.onClick!(); }) : undefined}
                  className="rounded-xl px-2 py-3 text-center transition-colors font-sans"
                  style={{ background: 'rgba(255,255,255,0.18)', cursor: s.onClick ? 'pointer' : undefined }}>
                  <p className="text-lg leading-none">{s.icon}</p>
                  <p className="font-display tabular-nums text-xl font-bold leading-none mt-1.5">{s.value}</p>
                  <p className="text-[11px] opacity-90 mt-1">{s.label}{s.onClick && ' ›'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters / sort / submitted */}
        <div className="flex items-center gap-2 flex-wrap">
          <select className="field py-1.5 px-3 text-sm flex-1 min-w-[110px]" value={filterTrack} onChange={e => setFilterTrack(e.target.value)}>
            <option value="">كل التصنيفات</option>
            {tracks.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="field py-1.5 px-3 text-sm flex-1 min-w-[110px]" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            <option value="">كل طرق التسليم</option>
            {methodsAvail.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
          </select>
          <select className="field py-1.5 px-3 text-sm flex-1 min-w-[110px]" value={sortBy} onChange={e => setSortBy(e.target.value as 'due' | 'points-desc' | 'points-asc')}>
            <option value="due">الأقرب موعداً</option>
            <option value="points-desc">النقاط: الأعلى</option>
            <option value="points-asc">النقاط: الأقل</option>
          </select>
          <button onClick={() => { setShowSubmitted(true); setExpandedSubId(null); }}
            className="btn text-white text-sm px-4 py-2 shrink-0 flex items-center gap-1.5 font-bold hover:opacity-90 transition-opacity"
            style={{ background: 'radial-gradient(circle at 80% 10%, rgba(255,159,28,0.12) 0%, transparent 50%), radial-gradient(circle at 20% 90%, rgba(18,179,213,0.15) 0%, transparent 60%), linear-gradient(135deg, #103F91 0%, #071F4A 100%)' }}>
            📋 المهام المسلَّمة
            {submittedItems.length > 0 && <span className="bg-white/25 rounded-full text-[11px] px-1.5 py-0.5 tabular-nums">{submittedItems.length}</span>}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 96 }} />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-display text-lg font-bold mb-1" style={{ color: 'var(--ink)' }}>لا توجد مهام نشطة</p>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>سنُعلمك حين تُضاف مهمة جديدة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(item => {
            const sub = item.submission;
            const tc = trackColor(item.task.track);
            const claimable = !sub || sub.status === 'cancelled' || sub.status === 'expired';
            const dl = sub?.status === 'claimed' ? claimDeadline(item) : null;

            let pill: { label: string; cls: string };
            if (claimable) {
              pill = sub?.status === 'expired' ? { label: 'انتهى الوقت', cls: 'pill-red' }
                   : sub?.status === 'cancelled' ? { label: 'ملغاة', cls: 'pill-gray' }
                   : { label: 'متاحة للطلب', cls: 'pill-blue' };
            }
            else if (sub!.status === 'claimed') pill = { label: 'بانتظار التسليم', cls: 'pill-yellow' };
            else if (sub!.status === 'pending') pill = { label: 'قيد المراجعة', cls: 'pill-yellow' };
            else if (sub!.status === 'rejected') pill = { label: 'مرفوض — أعد الإرسال', cls: 'pill-red' };
            else pill = { label: sub!.grade !== null ? `${sub!.grade} / ${item.task.maxPoints}` : 'مقبول', cls: 'pill-green' };

            return (
              <button
                key={item.task.id}
                onClick={() => openTask(item)}
                className="card p-0 text-right hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
                style={{ borderTop: `3px solid ${tc.solid}` }}
              >
                <div className="p-4 flex-1">
                  <div className="flex justify-end mb-2">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: `linear-gradient(135deg,${tc.from},${tc.to})` }}>
                      {item.task.track || 'عام'}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold mb-1.5 leading-snug" style={{ color: 'var(--ink)' }}>{item.task.title}</h3>
                  <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--ink-soft)' }}>{item.task.description}</p>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1" style={{ background: '#E7F6EC', color: '#047857' }}>🏆 {item.task.maxPoints} مكافأة</span>
                    {(item.task.cost ?? 0) > 0 && <span className="inline-flex items-center gap-1 rounded-md px-2 py-1" style={{ background: '#FEF3C7', color: '#B45309' }}>💰 {item.task.cost} مبلغ</span>}
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1" style={{ background: 'var(--bg-soft)', color: 'var(--ink-soft)' }}>📎 {METHOD_LABELS[methodKey(item.task.submissionMethod)]}</span>
                  </div>
                </div>
                <div className="px-4 py-2.5 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--line)' }}>
                  <span className={`pill ${pill.cls} text-xs`}>{pill.label}</span>
                  {dl != null && <span className="text-[11px] font-bold tabular-nums" style={{ color: dl - now <= 0 ? 'var(--red)' : 'var(--accent-deep)' }}>⏳ {fmtRemaining(dl - now)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Task detail / submission modal */}
      {selected && (
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-6" onClick={() => setSelected(null)}>
          <div className="modal-panel w-full max-w-lg max-h-[92vh] overflow-y-auto scroll-soft" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold" style={{ color: 'var(--ink)' }}>{selected.task.title}</h2>
                  {selected.task.track && (
                    <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: '#FBF6EC', color: 'var(--accent-deep)' }}>
                      {selected.task.track}
                    </span>
                  )}
                </div>
                <button onClick={() => setSelected(null)} className="btn btn-ghost p-2" aria-label="إغلاق">✕</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>{selected.task.description}</p>

              <div className="grid grid-cols-3 gap-2">
                <InfoBox icon="📅" label="الموعد النهائي" color="#103F91" bg="#EAF0FB"
                  value={<span dir="ltr">{new Date(selected.task.dueDate).toLocaleDateString('ar-SA')}</span>} />
                <InfoBox icon="💰" label="مبلغ الطلب" color="#854D0E" bg="#FEF3C7"
                  value={`${selected.task.cost ?? 0}`} />
                <InfoBox icon="🏆" label={selected.submission?.status === 'approved' ? 'النقاط المكتسبة' : 'النقاط القصوى'} color="#1B7A43" bg="#E7F6EC"
                  value={`${selected.submission?.status === 'approved' ? (selected.submission.grade ?? 0) : selected.task.maxPoints}`} />
              </div>

              {selected.task.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.task.imageUrl} alt="صورة المهمة" className="w-full rounded-xl object-cover max-h-48" />
              )}

              {selected.task.resourceLink && (
                <a
                  href={selected.task.resourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm rounded-xl p-3"
                  style={{ color: 'var(--blue)', background: '#EEF3FC' }}
                >
                  🔗 رابط المهمة / المرجع
                </a>
              )}

              {(() => {
                const s = selected.submission;
                const cost = selected.task.cost ?? 0;
                const claimable = !s || s.status === 'cancelled' || s.status === 'expired';
                const isClaimed = s?.status === 'claimed';
                const isRejected = s?.status === 'rejected';
                const isPending = s?.status === 'pending';
                const isApproved = s?.status === 'approved';
                const dl = isClaimed ? claimDeadline(selected) : null;
                const expiredNow = dl != null && dl - now <= 0;
                const canSubmit = (isClaimed && !expiredNow) || isRejected;

                return (
                  <>
                    {(isApproved || isPending) && (
                      <div className="rounded-xl p-4 border" style={{
                        background: isApproved ? '#E7F6EC' : '#FEF9C3',
                        borderColor: isApproved ? 'rgba(27,122,67,0.25)' : 'rgba(133,77,14,0.25)',
                      }}>
                        <p className="font-bold text-sm mb-1" style={{ color: isApproved ? '#1B7A43' : '#854D0E' }}>
                          {isApproved ? 'تم القبول ✓' : 'قيد المراجعة'}
                        </p>
                        {s!.grade !== null && (
                          <p className="tabular-nums text-sm" style={{ color: 'var(--ink)' }}>الدرجة: <strong>{s!.grade} / {selected.task.maxPoints}</strong></p>
                        )}
                        {s!.feedback && <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>ملاحظة المشرف: {s!.feedback}</p>}
                        {isApproved && cost > 0 && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>أُعيد مبلغ المهمة ({cost}) إلى رصيدك.</p>}
                      </div>
                    )}

                    {s?.status === 'expired' && (
                      <div className="rounded-xl p-4 border" style={{ background: '#FDEAE6', borderColor: 'rgba(196,41,16,0.25)' }}>
                        <p className="font-bold text-sm" style={{ color: '#C42910' }}>انتهى وقت المهمة</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>لم تُسلَّم في الوقت المحدد، ولا يمكن استرداد المبلغ المخصوم. يمكنك طلبها من جديد.</p>
                      </div>
                    )}
                    {s?.status === 'cancelled' && (
                      <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--line)' }}>
                        <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>مهمة ملغاة</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>يمكنك طلبها من جديد عند الرغبة.</p>
                      </div>
                    )}

                    {claimable && (
                      <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--line)' }}>
                        <div className="rounded-xl p-4" style={{ background: 'var(--bg-soft)' }}>
                          <p className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>اطلب المهمة للبدء</p>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                            {cost > 0 ? `سيُخصم ${cost} نقطة من رصيدك عند الطلب، وتُعاد كاملةً عند قبول تسليمك.` : 'لا تُخصم نقاط لطلب هذه المهمة.'}
                            {selected.task.durationHours ? ` لديك ${selected.task.durationHours} ساعة لإنهائها بعد الطلب.` : ''}
                          </p>
                          <p className="text-[11px] mt-2" style={{ color: 'var(--ink-soft)' }}>لديك {activeClaimCount} من ٣ مهام نشطة — ومهمة واحدة فقط لكل قسم.</p>
                        </div>
                        {atLimit && <p className="text-xs font-bold" style={{ color: 'var(--red)' }}>بلغتَ الحد الأقصى (٣ مهام نشطة) — أنهِ مهمة قبل طلب أخرى.</p>}
                        {subErr && <p className="err-msg">{subErr}</p>}
                        <div className="flex gap-3">
                          <button type="button" disabled={actionBusy || atLimit} onClick={() => claimTaskReq(selected)} className="btn btn-primary flex-1">
                            {actionBusy ? 'جارٍ الطلب…' : atLimit ? 'بلغت الحد الأقصى' : (cost > 0 ? `طلب المهمة (${cost} نقطة)` : 'طلب المهمة')}
                          </button>
                          <button type="button" onClick={() => setSelected(null)} className="btn btn-secondary">إغلاق</button>
                        </div>
                      </div>
                    )}

                    {isRejected && (
                      <div className="rounded-xl p-4 border" style={{ background: '#FDEAE6', borderColor: 'rgba(196,41,16,0.25)' }}>
                        <p className="font-bold text-sm" style={{ color: '#C42910' }}>مرفوض</p>
                        {s!.feedback && <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>ملاحظة المشرف: {s!.feedback}</p>}
                        <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>يمكنك إعادة التسليم بعد تصحيح الملاحظات.</p>
                      </div>
                    )}

                    {isClaimed && dl != null && (
                      <div className="rounded-xl p-3 text-sm font-bold text-center" style={{ background: expiredNow ? '#FDEAE6' : '#FBF6EC', color: expiredNow ? '#C42910' : 'var(--accent-deep)' }}>
                        {expiredNow ? 'انتهى وقت التسليم — لا يمكن التسليم' : `⏳ المتبقّي لإنهاء المهمة: ${fmtRemaining(dl - now)}`}
                      </div>
                    )}

                    {canSubmit && (
                      <form onSubmit={submitTask} className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                        <h3 className="font-display text-base font-bold" style={{ color: 'var(--ink)' }}>
                          {isRejected ? 'إعادة التسليم' : 'تسليم المهمة'}
                        </h3>

                        {(() => {
                    const method = methodKey(selected.task.submissionMethod);
                    if (method === 'text') {
                      return (
                        <div>
                          <label className="label">اكتب إجابتك</label>
                          <textarea className="field" rows={5} value={subText} onChange={e => setSubText(e.target.value)} placeholder="اكتب إجابتك هنا..." />
                        </div>
                      );
                    }
                    if (method === 'ack') {
                      return (
                        <label className="flex items-start gap-3 rounded-xl p-4 cursor-pointer border" style={{ borderColor: ackChecked ? 'var(--accent)' : 'var(--line)', background: ackChecked ? '#FBF6EC' : 'var(--bg-soft)' }}>
                          <input type="checkbox" checked={ackChecked} onChange={e => setAckChecked(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[var(--accent-deep)]" />
                          <span className="text-sm" style={{ color: 'var(--ink)' }}>أُقرّ بأنني أنجزت هذه المهمة على الوجه المطلوب.</span>
                        </label>
                      );
                    }
                    if (method === 'audio') {
                      return (
                        <div className="space-y-3">
                          <label className="label">سجّل إجابتك الصوتية</label>
                          <div className="flex items-center gap-3 flex-wrap">
                            {recording ? (
                              <button type="button" onClick={stopRecording} className="btn btn-danger flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" /> إيقاف التسجيل
                              </button>
                            ) : (
                              <button type="button" onClick={startRecording} className="btn btn-primary flex items-center gap-2">🎙️ {subFileDataUrl ? 'إعادة التسجيل' : 'بدء التسجيل'}</button>
                            )}
                            <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>أو</span>
                            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary">رفع ملف صوتي</button>
                          </div>
                          {subFileDataUrl && !recording && <audio controls src={subFileDataUrl} className="w-full" />}
                          <input ref={fileRef} type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
                        </div>
                      );
                    }
                    // file
                    return (
                      <div>
                        <label className="label">ارفع ملفاً</label>
                        <div
                          onClick={() => fileRef.current?.click()}
                          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
                          style={{ borderColor: subFile ? 'var(--blue)' : 'var(--line)', background: subFile ? '#EEF3FC' : 'var(--bg-soft)' }}
                        >
                          {subFile ? (
                            <div>
                              <p className="text-sm font-bold" style={{ color: 'var(--blue)' }}>{subFile.name}</p>
                              <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--ink-soft)' }}>{(subFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          ) : (
                            <>
                              <p className="text-2xl mb-2">📁</p>
                              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>اضغط لاختيار الملف</p>
                            </>
                          )}
                        </div>
                        <input ref={fileRef} type="file" className="hidden" accept="*/*" onChange={handleFileChange} />
                      </div>
                    );
                  })()}

                  {subErr && (
                    <p className="err-msg">{subErr}</p>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                      {submitting ? 'جارٍ الإرسال…' : 'تسليم المهمة'}
                    </button>
                    <button type="button" disabled={actionBusy} onClick={() => cancelTaskReq(selected)} className="btn btn-secondary" style={{ color: 'var(--red)' }}>
                      إلغاء المهمة
                    </button>
                  </div>
                </form>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Active (claimed) tasks — awaiting submission */}
      {showActive && (
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-6" onClick={() => setShowActive(false)}>
          <div className="modal-panel w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h2 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>مهام بانتظار التسليم</h2>
                <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{activeClaimCount}/3 مهام نشطة</p>
              </div>
              <button onClick={() => setShowActive(false)} className="btn btn-ghost p-2" aria-label="إغلاق">✕</button>
            </div>
            <div className="p-4 overflow-y-auto scroll-soft flex-1 space-y-2">
              {claimedItems.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-3xl mb-2">📥</p>
                  <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>لا توجد مهام مستلَمة بانتظار التسليم.</p>
                </div>
              ) : claimedItems.map(item => {
                const dl = claimDeadline(item);
                const remaining = dl != null ? dl - now : null;
                const tc = trackColor(item.task.track);
                return (
                  <div key={item.task.id} className="card p-3" style={{ borderRight: `4px solid ${tc.solid}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{item.task.title}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{item.task.track || 'عام'}</p>
                      </div>
                      <span className="pill pill-yellow text-xs shrink-0">بانتظار التسليم</span>
                    </div>
                    {remaining != null && (
                      <p className="text-xs font-bold mt-2 tabular-nums" style={{ color: remaining <= 0 ? 'var(--red)' : 'var(--accent-deep)' }}>
                        ⏳ {remaining <= 0 ? 'انتهى الوقت' : `المتبقّي: ${fmtRemaining(remaining)}`}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => { setShowActive(false); openTask(item); }} className="btn btn-primary text-xs flex-1">تسليم المهمة</button>
                      <button disabled={actionBusy} onClick={() => cancelTaskReq(item, false)} className="btn btn-secondary text-xs" style={{ color: 'var(--red)' }}>إلغاء المهمة</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Achievements / submitted-tasks dashboard */}
      {showSubmitted && (
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-6" onClick={() => setShowSubmitted(false)}>
          <div className="modal-panel w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h2 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>النقاط والإنجازات</h2>
                <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>تابع تقدّمك وإنجازاتك في برنامج المهام</p>
              </div>
              <button onClick={() => setShowSubmitted(false)} className="btn btn-ghost p-2" aria-label="إغلاق">✕</button>
            </div>

            <div className="p-4 overflow-y-auto scroll-soft flex-1 space-y-4">
              {/* total earned */}
              <div className="card p-5 text-center">
                <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>إجمالي النقاط المكتسبة</p>
                <p className="font-display tabular-nums text-5xl font-bold mt-1" style={{ color: '#1B7A43' }}>{earnedPoints}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* points by track */}
                <div className="card p-4">
                  <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--ink)' }}>📊 النقاط حسب المسار</h3>
                  {trackRows.length === 0 ? <p className="text-xs text-center py-3" style={{ color: 'var(--ink-soft)' }}>لا نقاط بعد</p>
                    : <div className="space-y-3">
                        {trackRows.map(r => { const c = trackColor(r.track); return (
                          <div key={r.track}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-bold" style={{ color: 'var(--ink)' }}>{r.track}</span>
                              <span className="font-bold" style={{ color: c.solid }}>{r.pts} نقطة</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.round((r.pts / maxTrackPts) * 100)}%`, background: `linear-gradient(90deg,${c.from},${c.to})` }} />
                            </div>
                          </div>
                        ); })}
                      </div>}
                </div>

                {/* completed / evaluated — accordion */}
                <div className="card p-4">
                  <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--ink)' }}>✅ المهام المنجزة والمقيّمة</h3>
                  {submittedItems.length === 0 ? <p className="text-xs text-center py-3" style={{ color: 'var(--ink-soft)' }}>لا مهام مسلّمة بعد</p>
                    : <div className="space-y-1.5">
                        {submittedItems.map(item => {
                          const sub = item.submission!;
                          const open = expandedSubId === item.task.id;
                          const badge = sub.status === 'approved' ? { cls: 'pill-green', label: `+${sub.grade ?? 0}` } : sub.status === 'rejected' ? { cls: 'pill-red', label: 'مرفوضة' } : { cls: 'pill-yellow', label: 'مراجعة' };
                          return (
                            <div key={item.task.id} className="rounded-lg border" style={{ borderColor: 'var(--line)' }}>
                              <button onClick={() => setExpandedSubId(id => id === item.task.id ? null : item.task.id)} className="w-full p-2.5 flex items-center gap-2 text-right">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{item.task.title}</p>
                                  <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{item.task.track || 'عام'}</p>
                                </div>
                                <span className={`pill ${badge.cls} text-[10px] py-0.5 px-2`}>{badge.label}</span>
                                <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--ink-soft)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                              </button>
                              {open && (
                                <div className="px-2.5 pb-2.5 text-[11px] fade-in" style={{ color: 'var(--ink-soft)' }}>
                                  <p>{sub.feedback ? `التعليق: ${sub.feedback}` : 'لا يوجد تعليق.'}</p>
                                  <p className="mt-1"><span dir="ltr">{new Date(sub.submittedAt).toLocaleDateString('ar-SA')}</span> · {METHOD_LABELS[methodKey(item.task.submissionMethod)]}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>}
                </div>
              </div>

              {/* not submitted */}
              <div className="card p-4" style={{ background: '#FFF7F5', borderColor: 'rgba(196,41,16,0.2)' }}>
                <h3 className="font-bold text-sm mb-3" style={{ color: '#C42910' }}>✖ مهام لم يتم تسليمها</h3>
                {notSubmittedItems.length === 0 ? <p className="text-xs text-center py-2" style={{ color: 'var(--ink-soft)' }}>لا شيء — أحسنت! 👏</p>
                  : <div className="space-y-1.5">
                      {notSubmittedItems.map(item => {
                        const expired = item.submission!.status === 'expired';
                        const cost = item.task.cost ?? 0;
                        const lost = expired ? cost : (cost - Math.floor(cost / 2));
                        const dl = claimDeadline(item);
                        const date = expired && dl ? new Date(dl) : new Date(item.task.dueDate);
                        return (
                          <div key={item.task.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{item.task.title}</p>
                              <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{item.task.track || 'عام'} · {expired ? 'انتهى الوقت' : 'ألغاها الطالب'} · <span dir="ltr">{date.toLocaleDateString('ar-SA')}</span></p>
                            </div>
                            <span className="text-xs font-bold shrink-0 tabular-nums" style={{ color: lost > 0 ? '#C42910' : 'var(--ink-soft)' }}>{lost > 0 ? `-${lost}` : '٠'}</span>
                          </div>
                        );
                      })}
                    </div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ icon, label, value, color, bg }: { icon: string; label: string; value: React.ReactNode; color: string; bg: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: bg }}>
      <p className="text-lg leading-none">{icon}</p>
      <p className="font-display tabular-nums text-base font-bold leading-none mt-1.5" style={{ color }}>{value}</p>
      <p className="text-[10px] mt-1 font-medium" style={{ color }}>{label}</p>
    </div>
  );
}
