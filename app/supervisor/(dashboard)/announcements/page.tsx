'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';

type Announcement = {
  id: number;
  title: string;
  body: string;
  audience: string;
  imageUrl?: string | null;
  images?: string | null;
  createdAt: string;
};

type Group = { id: number; name: string; stage: string };

const STAGES = [
  { key: 'stage:ابتدائي', label: 'مرحلة الابتدائي' },
  { key: 'stage:متوسط', label: 'مرحلة المتوسط' },
  { key: 'stage:ثانوي', label: 'مرحلة الثانوي' }
];

// SVG Icon components matching the website style
const SpeakerIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

const EditIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EyeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const CloseIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Helper function to compress base64 images client-side before sending
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.75): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

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
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [contentImages, setContentImages] = useState<string[]>([]);

  // Detailed Modal View state
  const [activeDetails, setActiveDetails] = useState<Announcement | null>(null);

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

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImage(reader.result as string, 900, 900, 0.8);
      setCoverImage(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleContentImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string, 800, 800, 0.7);
        setContentImages((prev) => [...prev, compressed]);
      };
      reader.readAsDataURL(file);
    });
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
      imageUrl: coverImage,
      images: contentImages.length > 0 ? JSON.stringify(contentImages) : null
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
    setActiveDetails(null);
    setEditId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setCoverImage(a.imageUrl || null);
    
    let contentImgs: string[] = [];
    if (a.images) {
      try {
        contentImgs = JSON.parse(a.images);
      } catch {
        contentImgs = [];
      }
    }
    setContentImages(contentImgs);

    // Filter out legacy values like 'all', 'students', 'guardians' so they do not stack with stage/group values
    const filteredAudience = a.audience
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x.startsWith('stage:') || x.startsWith('group:'));
    setSelectedAudience(filteredAudience);
  };

  const cancelEdit = () => {
    setEditId(null);
    setTitle('');
    setBody('');
    setCoverImage(null);
    setContentImages([]);
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
    if (activeDetails?.id === id) setActiveDetails(null);
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
      .filter(Boolean)
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

          {/* 1. Cover Image Upload (ABOVE title) */}
          <div>
            <label className="label">صورة الغلاف / مصغرة الإعلان (اختياري)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="field w-full cursor-pointer file:ml-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cream-100 file:text-brand hover:file:bg-cream-200"
            />
            {coverImage && (
              <div className="mt-2.5 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImage}
                  alt="معاينة الغلاف"
                  className="w-full h-36 object-cover rounded-xl border border-ink-200 shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 leading-none shadow-md flex items-center justify-center"
                  title="إزالة الصورة"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 2. Title Input */}
          <div>
            <label className="label">عنوان الإعلان</label>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="اكتب عنوان الإعلان هنا…"
            />
          </div>

          {/* 3. Content Textarea */}
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

          {/* 4. Multiple Content Images Upload (BELOW content) */}
          <div>
            <label className="label">صور إضافية للمنشور (اختياري - متعدد)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleContentImagesChange}
              className="field w-full cursor-pointer file:ml-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cream-100 file:text-brand hover:file:bg-cream-200"
            />
            {contentImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                {contentImages.map((src, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-ink-150 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`مرفق ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setContentImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 leading-none shadow-md flex items-center justify-center"
                      title="حذف"
                    >
                      <CloseIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
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

        {/* Compact Announcements List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="card p-12 text-center text-ink-400 text-sm">جارٍ تحميل الإعلانات…</div>
          ) : items.length === 0 ? (
            <div className="card p-12 text-center text-ink-400 text-sm">لا توجد إعلانات منشورة حالياً.</div>
          ) : (
            items.map((a) => (
              <div
                key={a.id}
                className="card bg-white border border-ink-150 hover:shadow-md transition-shadow p-3 flex gap-4 items-center"
              >
                {/* Small Cover Image Thumbnail */}
                {a.imageUrl ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-ink-100 bg-ink-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.imageUrl}
                      alt={a.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-cream-50 flex items-center justify-center flex-shrink-0 text-brand-600 border border-ink-100">
                    <SpeakerIcon className="w-6 h-6 text-brand" />
                  </div>
                )}

                {/* Text Info (Title & Short description snippet) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="font-bold text-ink-900 text-sm truncate max-w-[200px] sm:max-w-xs">{a.title}</h3>
                    <span className="pill pill-blue text-[10px] py-0.5 px-2 truncate flex items-center gap-1" title={audLabel(a.audience)}>
                      <SpeakerIcon className="w-3 h-3 text-brand-600" />
                      {audLabel(a.audience)}
                    </span>
                  </div>
                  
                  {/* Short snippet of content */}
                  <p className="text-xs text-ink-500 line-clamp-1 leading-relaxed pl-2">
                    {a.body}
                  </p>

                  <div className="text-[9px] text-ink-400 mt-1" dir="ltr">
                    {new Date(a.createdAt).toLocaleString('ar')}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-row gap-1 flex-shrink-0 items-center">
                  <button
                    onClick={() => setActiveDetails(a)}
                    className="btn btn-secondary py-1 px-2 text-[11px] font-semibold flex items-center gap-1"
                    type="button"
                    title="عرض كامل التفاصيل"
                  >
                    <EyeIcon className="w-3 h-3 text-ink-600" />
                    عرض
                  </button>
                  <button
                    onClick={() => startEdit(a)}
                    className="btn btn-secondary py-1 px-2 text-[11px] font-semibold flex items-center gap-1"
                    type="button"
                  >
                    <EditIcon className="w-3 h-3 text-ink-600" />
                    تعديل
                  </button>
                  <button
                    onClick={() => del(a.id)}
                    className="btn btn-danger py-1 px-2 text-[11px] font-semibold flex items-center justify-center"
                    type="button"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detailed Modal for viewing full announcement */}
      {activeDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-ink-150 flex flex-col">
            
            {/* Modal Cover Image */}
            {activeDetails.imageUrl && (
              <div className="relative h-56 w-full overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeDetails.imageUrl}
                  alt={activeDetails.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setActiveDetails(null)}
                  className="absolute top-3 right-3 bg-black/65 hover:bg-black/85 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors shadow-md leading-none"
                  type="button"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {!activeDetails.imageUrl && (
                <div className="flex justify-between items-start border-b border-ink-100 pb-3">
                  <h2 className="text-xl font-bold text-ink-900">{activeDetails.title}</h2>
                  <button
                    onClick={() => setActiveDetails(null)}
                    className="text-ink-400 hover:text-ink-600 flex items-center justify-center"
                    type="button"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              )}

              {activeDetails.imageUrl && (
                <div className="border-b border-ink-100 pb-2">
                  <h2 className="text-xl font-bold text-ink-900">{activeDetails.title}</h2>
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-3 text-xs text-ink-500 flex-wrap">
                <span>📅 {new Date(activeDetails.createdAt).toLocaleString('ar')}</span>
                <span className="pill pill-blue text-[11px] flex items-center gap-1">
                  <SpeakerIcon className="w-3 h-3 text-brand-600" />
                  الجمهور: {audLabel(activeDetails.audience)}
                </span>
              </div>

              {/* Full Text */}
              <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
                {activeDetails.body}
              </p>

              {/* Content Gallery */}
              {(() => {
                let contentImgList: string[] = [];
                if (activeDetails.images) {
                  try {
                    contentImgList = JSON.parse(activeDetails.images);
                  } catch {}
                }
                if (contentImgList.length === 0) return null;
                return (
                  <div className="space-y-2 border-t border-ink-100 pt-4">
                    <h4 className="text-xs font-bold text-ink-900">الصور المرفقة بالمنشور:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {contentImgList.map((src, idx) => (
                        <div key={idx} className="overflow-hidden rounded-xl border border-ink-150 shadow-sm aspect-video bg-ink-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={`مرفق تفاصيل ${idx + 1}`}
                            onClick={() => window.open(src, '_blank')}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-ink-100 flex justify-end bg-cream-50/50 rounded-b-2xl flex-shrink-0">
              <button
                onClick={() => setActiveDetails(null)}
                className="btn btn-secondary px-5 py-1.5"
                type="button"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
