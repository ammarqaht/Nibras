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
    submittedAt: string;
  } | null;
};

const METHOD_LABELS: Record<string, string> = {
  image: 'صورة',
  file: 'ملف',
  audio: 'تسجيل صوتي',
  text: 'نص',
  video: 'فيديو',
  any: 'أي نوع',
};

function statusRank(s: TaskItem) {
  if (!s.submission) return 0; // active, not submitted → first
  if (s.submission.status === 'pending') return 1;
  if (s.submission.status === 'rejected') return 2;
  return 3; // approved / graded → last
}

export default function StudentTasks() {
  const [items, setItems] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TaskItem | null>(null);

  // Submission form state
  const [subText, setSubText] = useState('');
  const [subFile, setSubFile] = useState<File | null>(null);
  const [subFileDataUrl, setSubFileDataUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subErr, setSubErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/student/tasks')
      .then(r => r.json())
      .then(d => setItems(d.tasks || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  function openTask(item: TaskItem) {
    setSelected(item);
    setSubText('');
    setSubFile(null);
    setSubFileDataUrl('');
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

  async function submitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setSubErr('');

    let fileUrl = '';
    const method = selected.task.submissionMethod;

    if (method === 'text') {
      if (!subText.trim()) { setSubErr('الرجاء كتابة النص'); setSubmitting(false); return; }
      fileUrl = 'text:' + subText.trim();
    } else {
      if (!subFile) { setSubErr('الرجاء اختيار الملف'); setSubmitting(false); return; }
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
      setSelected(null);
      load();
    } catch {
      setSubErr('تعذّر الاتصال بالخادم');
      setSubmitting(false);
    }
  }

  const sorted = [...items].sort((a, b) => statusRank(a) - statusRank(b) || +new Date(a.task.dueDate) - +new Date(b.task.dueDate));
  const now = new Date();

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
            const overdue = !item.submission && due < now;
            const sub = item.submission;

            let pill: { label: string; cls: string };
            if (!sub) pill = { label: overdue ? 'منتهية' : 'لم يُسلَّم', cls: overdue ? 'pill-red' : 'pill-blue' };
            else if (sub.status === 'pending') pill = { label: 'قيد المراجعة', cls: 'pill-yellow' };
            else if (sub.status === 'rejected') pill = { label: 'مرفوض — أعد الإرسال', cls: 'pill-red' };
            else pill = { label: sub.grade !== null ? `${sub.grade} / ${item.task.maxPoints}` : 'مقبول', cls: 'pill-green' };

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
                      <span className="tabular-nums">⏰ <span dir="ltr">{due.toLocaleDateString('ar-SA')}</span></span>
                      <span>🎯 {item.task.maxPoints} نقطة</span>
                      <span>📎 {METHOD_LABELS[item.task.submissionMethod] || item.task.submissionMethod}</span>
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

              {selected.submission && (
                <div className="rounded-xl p-4 border" style={{
                  background: selected.submission.status === 'approved' ? '#E7F6EC'
                    : selected.submission.status === 'rejected' ? '#FDEAE6' : '#FEF9C3',
                  borderColor: selected.submission.status === 'approved' ? 'rgba(27,122,67,0.25)'
                    : selected.submission.status === 'rejected' ? 'rgba(196,41,16,0.25)' : 'rgba(133,77,14,0.25)',
                }}>
                  <p className="font-bold text-sm mb-1" style={{
                    color: selected.submission.status === 'approved' ? '#1B7A43'
                      : selected.submission.status === 'rejected' ? '#C42910' : '#854D0E',
                  }}>
                    {selected.submission.status === 'approved' ? 'تم القبول ✓'
                      : selected.submission.status === 'rejected' ? 'مرفوض'
                      : 'قيد المراجعة'}
                  </p>
                  {selected.submission.grade !== null && (
                    <p className="tabular-nums text-sm" style={{ color: 'var(--ink)' }}>
                      الدرجة: <strong>{selected.submission.grade} / {selected.task.maxPoints}</strong>
                    </p>
                  )}
                  {selected.submission.feedback && (
                    <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>ملاحظة المشرف: {selected.submission.feedback}</p>
                  )}
                  {selected.submission.status === 'rejected' && (
                    <p className="text-xs mt-3" style={{ color: 'var(--ink-soft)' }}>يمكنك إعادة التسليم بعد تصحيح الملاحظات.</p>
                  )}
                </div>
              )}

              {(!selected.submission || selected.submission.status === 'rejected') && (
                <form onSubmit={submitTask} className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                  <h3 className="font-display text-base font-bold" style={{ color: 'var(--ink)' }}>
                    {selected.submission?.status === 'rejected' ? 'إعادة التسليم' : 'تسليم المهمة'}
                  </h3>

                  {selected.task.submissionMethod === 'text' ? (
                    <div>
                      <label className="label">اكتب إجابتك</label>
                      <textarea
                        className="field"
                        rows={5}
                        value={subText}
                        onChange={e => setSubText(e.target.value)}
                        placeholder="اكتب إجابتك هنا..."
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="label">
                        {selected.task.submissionMethod === 'image' ? 'ارفع صورة' :
                         selected.task.submissionMethod === 'audio' ? 'ارفع تسجيلاً صوتياً' :
                         selected.task.submissionMethod === 'video' ? 'ارفع فيديو' :
                         selected.task.submissionMethod === 'file' ? 'ارفع ملفاً' :
                         'ارفع الملف'}
                      </label>
                      <div
                        onClick={() => fileRef.current?.click()}
                        className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
                        style={{ borderColor: subFile ? 'var(--blue)' : 'var(--line)', background: subFile ? '#EEF3FC' : 'var(--bg-soft)' }}
                      >
                        {subFile ? (
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--blue)' }}>{subFile.name}</p>
                            <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--ink-soft)' }}>
                              {(subFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        ) : (
                          <>
                            <p className="text-2xl mb-2">
                              {selected.task.submissionMethod === 'image' ? '🖼️' :
                               selected.task.submissionMethod === 'audio' ? '🎙️' :
                               selected.task.submissionMethod === 'video' ? '🎥' : '📁'}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>اضغط لاختيار الملف</p>
                          </>
                        )}
                      </div>
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept={
                          selected.task.submissionMethod === 'image' ? 'image/*' :
                          selected.task.submissionMethod === 'audio' ? 'audio/*' :
                          selected.task.submissionMethod === 'video' ? 'video/*' : '*/*'
                        }
                        onChange={handleFileChange}
                      />
                    </div>
                  )}

                  {subErr && (
                    <p className="err-msg">{subErr}</p>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                      {submitting ? 'جارٍ الإرسال…' : 'تسليم المهمة'}
                    </button>
                    <button type="button" onClick={() => setSelected(null)} className="btn btn-secondary">
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
