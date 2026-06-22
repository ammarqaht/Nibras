'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';

type Announcement = {
  id: number;
  title: string;
  body: string;
  audience: string;
  imageUrl?: string | null;
  createdAt: string;
};

type Group = { id: number; name: string; stage: string };

const STAGES = [
  { key: 'stage:ابتدائي', label: 'مرحلة الابتدائي' },
  { key: 'stage:متوسط', label: 'مرحلة المتوسط' },
  { key: 'stage:ثانوي', label: 'مرحلة الثانوي' }
];

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form states
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);

  async function loadAnnouncements() {
    const r = await fetch('/api/supervisor/announcements', { cache: 'no-store' });
    setItems((await r.json().catch(() => ({ announcements: [] }))).announcements ?? []);
  }

  async function loadGroups() {
    const r = await fetch('/api/supervisor/groups', { cache: 'no-store' });
    setGroups((await r.json().catch(() => ({ groups: [] }))).groups ?? []);
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadAnnouncements(), loadGroups()]);
      setLoading(false);
    })();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleAudience = (key: string) => {
    setSelectedAudience((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return pushToast('error', 'أكمل العنوان والمحتوى');
    if (selectedAudience.length === 0) return pushToast('error', 'يرجى اختيار فئة جمهور واحدة على الأقل');

    setBusy(true);
    const audienceStr = selectedAudience.join(',');

    const payload = {
      id: editId ?? undefined,
      title: title.trim(),
      body: body.trim(),
      audience: audienceStr,
      imageUrl: image
    };

    const r = await fetch('/api/supervisor/announcements', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل حفظ الإعلان');

    pushToast('success', editId ? 'تم تعديل الإعلان بنجاح' : 'تم نشر الإعلان بنجاح');
    cancelEdit();
    loadAnnouncements();
  }

  const startEdit = (a: Announcement) => {
    setEditId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setImage(a.imageUrl || null);
    if (a.audience === 'all' || a.audience === 'students' || a.audience === 'guardians') {
      setSelectedAudience([a.audience]);
    } else {
      setSelectedAudience(a.audience.split(','));
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setTitle('');
    setBody('');
    setImage(null);
    setSelectedAudience([]);
  };

  async function del(id: number) {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً؟')) return;
    setBusy(true);
    const r = await fetch(`/api/supervisor/announcements?id=${id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return pushToast('error', j.error ?? 'فشل حذف الإعلان');
    }
    pushToast('success', 'تم حذف الإعلان بنجاح');
    if (editId === id) cancelEdit();
    loadAnnouncements();
  }

  const audLabel = (audienceStr: string) => {
    if (audienceStr === 'all') return 'الجميع';
    if (audienceStr === 'students') return 'الطلاب';
    if (audienceStr === 'guardians') return 'أولياء الأمور';

    return audienceStr
      .split(',')
      .map((item) => {
        const [type, val] = item.split(':');
        if (type === 'stage') return val;
        if (type === 'group') {
          const gId = parseInt(val, 10);
          return groups.find((g) => g.id === gId)?.name || `مجموعة #${gId}`;
        }
        return item;
      })
      .join('، ');
  };

  return (
    <div className="font-sans text-right" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">الإشهار والإعلانات</h1>
        <p className="text-sm text-ink-500">نشر وتعديل الإعلانات الموجهة لطلاب وأسر النادي.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form panel */}
        <form onSubmit={handleSubmit} className="card p-5 space-y-4 self-start bg-white shadow-sm border border-ink-150">
          <h2 className="text-lg font-bold text-ink-900 border-b border-ink-100 pb-2">
            {editId ? 'تعديل الإعلان الحالي' : 'إنشاء إعلان جديد'}
          </h2>
          <div>
            <label className="label">عنوان الإعلان</label>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="اكتب عنوان الإعلان هنا…"
            />
          </div>
          <div>
            <label className="label">محتوى الإعلان</label>
            <textarea
              className="field"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اكتب تفاصيل الإعلان هنا…"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="label">صورة الإعلان (اختياري)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="field w-full cursor-pointer file:ml-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cream-100 file:text-brand hover:file:bg-cream-200"
            />
            {image && (
              <div className="mt-2.5 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt="معاينة"
                  className="w-full h-36 object-cover rounded-xl border border-ink-200 shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 leading-none shadow-md"
                  title="إزالة الصورة"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Audience selection */}
          <div className="space-y-2 border-t border-ink-100 pt-3">
            <label className="label font-bold">تحديد فئة الجمهور المستهدف</label>
            
            <div className="space-y-3 max-h-56 overflow-y-auto scroll-soft border border-ink-150 rounded-xl p-3 bg-cream-50/30">
              {/* Stages List */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-brand-600 block mb-1">تصفية حسب المراحل:</span>
                {STAGES.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-ink-800">
                    <input
                      type="checkbox"
                      checked={selectedAudience.includes(s.key)}
                      onChange={() => toggleAudience(s.key)}
                      className="rounded border-ink-300 text-brand w-4 h-4 focus:ring-brand"
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>

              {/* Groups List */}
              {groups.length > 0 && (
                <div className="space-y-1 border-t border-ink-100 pt-2.5">
                  <span className="text-xs font-bold text-brand-600 block mb-1">تصفية حسب المجموعات/الأسرة:</span>
                  {groups.map((g) => {
                    const key = `group:${g.id}`;
                    return (
                      <label key={g.id} className="flex items-center gap-2 cursor-pointer select-none text-sm text-ink-800">
                        <input
                          type="checkbox"
                          checked={selectedAudience.includes(key)}
                          onChange={() => toggleAudience(key)}
                          className="rounded border-ink-300 text-brand w-4 h-4 focus:ring-brand"
                        />
                        <span>{g.name} ({g.stage})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={busy} className="btn btn-primary flex-1">
              {busy ? 'جاري الحفظ…' : editId ? 'حفظ التعديلات' : 'نشر الإعلان'}
            </button>
            {editId && (
              <button type="button" onClick={cancelEdit} className="btn btn-secondary">
                إلغاء
              </button>
            )}
          </div>
        </form>

        {/* Announcements List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="card p-12 text-center text-ink-400 text-sm">جارٍ تحميل الإعلانات…</div>
          ) : items.length === 0 ? (
            <div className="card p-12 text-center text-ink-400 text-sm">لا توجد إعلانات منشورة حالياً.</div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="card p-5 bg-white border border-ink-150 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div>
                    <h3 className="font-bold text-ink-900 text-base leading-snug">{a.title}</h3>
                    <div className="text-[0.7rem] text-ink-400 mt-1" dir="ltr">
                      {new Date(a.createdAt).toLocaleString('ar')}
                    </div>
                  </div>
                  <span className="pill pill-blue text-xs max-w-xs truncate" title={audLabel(a.audience)}>
                    📢 {audLabel(a.audience)}
                  </span>
                </div>
                
                {a.imageUrl && (
                  <div className="my-3 overflow-hidden rounded-xl border border-ink-150 shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.imageUrl}
                      alt={a.title}
                      onClick={() => window.open(a.imageUrl!, '_blank')}
                      className="w-full max-h-72 object-cover cursor-pointer hover:scale-[1.01] transition-transform duration-200"
                    />
                  </div>
                )}

                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap mt-2">{a.body}</p>

                <div className="flex gap-2 justify-end mt-4 border-t border-ink-100 pt-3">
                  <button
                    onClick={() => startEdit(a)}
                    className="btn btn-secondary py-1 px-3 text-xs"
                  >
                    ✎ تعديل الإعلان
                  </button>
                  <button
                    onClick={() => del(a.id)}
                    className="btn btn-danger py-1 px-3 text-xs"
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
