'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';

type Announcement = { id: number; title: string; body: string; audience: string; createdAt: string };

const AUDIENCES = [
  { key: 'all', label: 'الجميع' },
  { key: 'students', label: 'الطلاب' },
  { key: 'guardians', label: 'أولياء الأمور' }
];
const audLabel = (k: string) => AUDIENCES.find((a) => a.key === k)?.label ?? k;

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/supervisor/announcements', { cache: 'no-store' });
    setItems((await r.json().catch(() => ({ announcements: [] }))).announcements ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return pushToast('error', 'أكمل العنوان والمحتوى');
    setBusy(true);
    const r = await fetch('/api/supervisor/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), body: body.trim(), audience })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل نشر الإعلان');
    pushToast('success', 'تم نشر الإعلان');
    setTitle(''); setBody('');
    load();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">الإشعارات والإعلانات</h1>
        <p className="text-sm text-ink-500">انشر إعلاناً موجهاً للطلاب أو أولياء الأمور.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form onSubmit={publish} className="card p-6 space-y-4 self-start">
          <h2 className="text-lg font-bold text-ink-900">إعلان جديد</h2>
          <div>
            <label className="label">العنوان</label>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإعلان" />
          </div>
          <div>
            <label className="label">المحتوى</label>
            <textarea className="field" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص الإعلان…" />
          </div>
          <div>
            <label className="label">الجمهور</label>
            <select className="field" value={audience} onChange={(e) => setAudience(e.target.value)}>
              {AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? '...' : 'نشر الإعلان'}</button>
        </form>

        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="card p-10 text-center text-ink-400 text-sm">جارٍ التحميل…</div>
          ) : items.length === 0 ? (
            <div className="card p-10 text-center text-ink-400 text-sm">لا توجد إعلانات منشورة.</div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="card p-5">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <h3 className="font-bold text-ink-900">{a.title}</h3>
                  <span className="pill pill-blue">{audLabel(a.audience)}</span>
                </div>
                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{a.body}</p>
                <div className="text-xs text-ink-400 mt-3" dir="ltr">
                  {new Date(a.createdAt).toLocaleString('ar')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
