'use client';

import { useEffect, useState, useRef } from 'react';

type TaskItem = {
  task: {
    id: string;
    title: string;
    description: string;
    maxPoints: number;
    dueDate: string;
    startDate: string | null;
    track: string;
    submissionMethod: string; // 'image' | 'file' | 'audio' | 'text' | 'video' | 'any'
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

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'قيد المراجعة', color: '#d97706', bg: '#fffbeb' },
  approved: { label: 'مقبول ✓', color: '#16a34a', bg: '#f0fdf4' },
  rejected: { label: 'مرفوض', color: 'var(--red)', bg: '#fef2f2' },
};

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
      // Use base64 data URL as storage (in production this would upload to storage)
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

  const now = new Date();

  if (loading) {
    return <div className="text-center py-20" style={{ color: 'var(--ink-soft)' }}>جارٍ التحميل...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-5" style={{ color: 'var(--ink)' }}>المهام</h1>

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p style={{ color: 'var(--ink-soft)' }}>لا توجد مهام نشطة حالياً.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const due = new Date(item.task.dueDate);
            const overdue = !item.submission && due < now;
            const sub = item.submission;
            const st = sub ? STATUS_LABELS[sub.status] : null;

            return (
              <button
                key={item.task.id}
                onClick={() => openTask(item)}
                className="card w-full p-4 text-right hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{item.task.title}</span>
                      {item.task.track && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#FBF6EC', color: 'var(--accent-deep)' }}>
                          {item.task.track}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ink-soft)' }}>{item.task.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs" style={{ color: overdue ? 'var(--red)' : 'var(--ink-soft)' }}>
                        ⏰ {due.toLocaleDateString('ar-SA')}
                        {overdue && ' (منتهية)'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                        🎯 {item.task.maxPoints} نقطة
                      </span>
                      <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                        📎 {METHOD_LABELS[item.task.submissionMethod] || item.task.submissionMethod}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {st ? (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ color: 'var(--blue)', background: '#EEF3FC' }}>
                        لم يُسلَّم
                      </span>
                    )}
                  </div>
                </div>
                {sub?.status === 'approved' && sub.grade !== null && (
                  <div className="mt-2 pt-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--line)' }}>
                    <span className="text-xs font-bold" style={{ color: '#16a34a' }}>الدرجة: {sub.grade} / {item.task.maxPoints}</span>
                    {sub.feedback && <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>— {sub.feedback}</span>}
                  </div>
                )}
                {sub?.status === 'rejected' && sub.feedback && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                    <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>ملاحظة المشرف: {sub.feedback}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Task detail / submission modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-lg" style={{ color: 'var(--ink)' }}>{selected.task.title}</h2>
                  {selected.task.track && (
                    <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: '#FBF6EC', color: 'var(--accent-deep)' }}>
                      {selected.task.track}
                    </span>
                  )}
                </div>
                <button onClick={() => setSelected(null)} className="btn btn-ghost p-2">✕</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>{selected.task.description}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-soft)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-soft)' }}>الموعد النهائي</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{new Date(selected.task.dueDate).toLocaleDateString('ar-SA')}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-soft)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-soft)' }}>الدرجة القصوى</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{selected.task.maxPoints} نقطة</p>
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

              {/* Existing submission */}
              {selected.submission ? (
                <div className="rounded-xl p-4 border" style={{
                  background: selected.submission.status === 'approved' ? '#f0fdf4' : selected.submission.status === 'rejected' ? '#fef2f2' : '#fffbeb',
                  borderColor: selected.submission.status === 'approved' ? '#86efac' : selected.submission.status === 'rejected' ? '#fca5a5' : '#fde68a',
                }}>
                  <p className="font-bold text-sm mb-2">
                    {STATUS_LABELS[selected.submission.status]?.label || selected.submission.status}
                  </p>
                  {selected.submission.grade !== null && (
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>الدرجة: <strong>{selected.submission.grade} / {selected.task.maxPoints}</strong></p>
                  )}
                  {selected.submission.feedback && (
                    <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>ملاحظة المشرف: {selected.submission.feedback}</p>
                  )}
                  {selected.submission.status === 'rejected' && (
                    <p className="text-xs mt-3" style={{ color: 'var(--ink-soft)' }}>يمكنك إعادة التسليم بعد تصحيح الملاحظات.</p>
                  )}
                </div>
              ) : null}

              {/* Submission form — show if not submitted or rejected */}
              {(!selected.submission || selected.submission.status === 'rejected') && (
                <form onSubmit={submitTask} className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
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
                            <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
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
                    <p className="text-sm rounded-md p-2" style={{ color: 'var(--red)', background: '#FDEAE6' }}>{subErr}</p>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                      {submitting ? 'جارٍ الإرسال...' : 'تسليم المهمة'}
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
