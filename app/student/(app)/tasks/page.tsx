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

  async function cancelTaskReq(item: TaskItem) {
    if (!window.confirm('إلغاء المهمة؟ سيُعاد إليك نصف المبلغ فقط.')) return;
    setActionBusy(true); setSubErr('');
    try {
      const r = await fetch('/api/student/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', taskId: item.task.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setSubErr(j.error || 'تعذّر الإلغاء'); return; }
      await refresh(item.task.id);
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

  const sorted = [...items].sort((a, b) => statusRank(a) - statusRank(b) || +new Date(a.task.dueDate) - +new Date(b.task.dueDate));
  const activeClaimCount = items.filter(i => i.submission && ['claimed', 'pending', 'rejected'].includes(i.submission.status)).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--ink)' }}>المهام</h1>
        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          {items.length} {items.length === 1 ? 'مهمة' : 'مهام'}
        </span>
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
        <div className="space-y-3">
          {sorted.map(item => {
            const due = new Date(item.task.dueDate);
            const sub = item.submission;
            const claimable = !sub || sub.status === 'cancelled' || sub.status === 'expired';
            const overdue = claimable && due.getTime() < now;

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
                className="card w-full p-4 text-right hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-base font-bold" style={{ color: 'var(--ink)' }}>{item.task.title}</span>
                      {item.task.track && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#FBF6EC', color: 'var(--accent-deep)' }}>
                          {item.task.track}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ink-soft)' }}>{item.task.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs" style={{ color: overdue ? 'var(--red)' : 'var(--ink-soft)' }}>
                      <span>🎯 {item.task.maxPoints} نقطة</span>
                      {(item.task.cost ?? 0) > 0 && <span>💰 {item.task.cost} للطلب</span>}
                      <span>📎 {METHOD_LABELS[methodKey(item.task.submissionMethod)]}</span>
                      {sub?.status === 'claimed' && (() => { const dl = claimDeadline(item); return dl ? <span style={{ color: dl - now <= 0 ? 'var(--red)' : 'var(--accent-deep)', fontWeight: 700 }}>⏳ {fmtRemaining(dl - now)}</span> : null; })()}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className={`pill ${pill.cls}`}>{pill.label}</span>
                  </div>
                </div>
                {sub?.status === 'approved' && sub.feedback && (
                  <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                    ملاحظة المشرف: {sub.feedback}
                  </div>
                )}
                {sub?.status === 'rejected' && sub.feedback && (
                  <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                    ملاحظة المشرف: {sub.feedback}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Task detail / submission modal */}
      {selected && (
        <div className="modal-backdrop flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={() => setSelected(null)}>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-soft)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-soft)' }}>الموعد النهائي</p>
                  <p className="font-display tabular-nums text-base font-bold" style={{ color: 'var(--ink)' }} dir="ltr">
                    {new Date(selected.task.dueDate).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-soft)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-soft)' }}>الدرجة القصوى</p>
                  <p className="font-display tabular-nums text-base font-bold" style={{ color: 'var(--ink)' }}>
                    {selected.task.maxPoints} نقطة
                  </p>
                </div>
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
                        {subErr && <p className="err-msg">{subErr}</p>}
                        <div className="flex gap-3">
                          <button type="button" disabled={actionBusy} onClick={() => claimTaskReq(selected)} className="btn btn-primary flex-1">
                            {actionBusy ? 'جارٍ الطلب…' : (cost > 0 ? `طلب المهمة (${cost} نقطة)` : 'طلب المهمة')}
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
    </div>
  );
}
