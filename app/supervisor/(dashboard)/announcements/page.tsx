'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { compressImage } from '@/lib/imageUtils';

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


export default function AnnouncementsPage() {
  const { user } = useSupervisor();
  const roles = user?.role ? user.role.split(',').map(r => r.trim()) : [];
  const canManageAnnouncements = roles.some(r => ['admin', 'media_supervisor'].includes(r));

  const [items, setItems] = useState<Announcement[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form states
  const [showFormModal, setShowFormModal] = useState(false);
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

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 100);
      setCoverImage(compressed);
    } catch (err) {
      console.error(err);
    }
  };

  const handleContentImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(async (file) => {
      try {
        const compressed = await compressImage(file, 100);
        setContentImages((prev) => [...prev, compressed]);
      } catch (err) {
        console.error(err);
      }
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
    setShowFormModal(true);
  };

  const cancelEdit = () => {
    setEditId(null);
    setTitle('');
    setBody('');
    setCoverImage(null);
    setContentImages([]);
    setSelectedAudience([]);
    setShowFormModal(false);
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
      <div className="mb-6 flex justify-between items-center flex-wrap gap-4 border-b border-ink-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">الإشهار والإعلانات</h1>
          <p className="text-sm text-ink-500">نشر وتعديل الإعلانات الموجهة لطلاب وأسر النادي.</p>
        </div>
        {canManageAnnouncements && <button
          onClick={() => {
            cancelEdit();
            setShowFormModal(true);
          }}
          className="btn btn-primary px-5 py-2.5 font-bold flex items-center gap-2 shadow-sm hover:shadow"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" />
            <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" />
          </svg>
          <span>إنشاء إعلان جديد</span>
        </button>}
      </div>

      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-ink-150 flex flex-col font-sans">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-line bg-cream-50/50">
              <h2 className="text-lg font-bold text-ink-900">
                {editId ? 'تعديل الإعلان الحالي' : 'إنشاء إعلان جديد'}
              </h2>
              <button 
                type="button"
                onClick={() => {
                  cancelEdit();
                  setShowFormModal(false);
                }}
                className="text-ink-400 hover:text-ink-900 font-bold p-1 flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Cover Image Upload */}
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
                      className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-md flex items-center justify-center"
                      title="إزالة الصورة"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Title Input */}
              <div>
                <label className="label">عنوان الإعلان</label>
                <input
                  className="field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="اكتب عنوان الإعلان هنا…"
                />
              </div>

              {/* Content Textarea */}
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

              {/* Multiple Content Images Upload */}
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
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md flex items-center justify-center"
                          title="حذف"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
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
                <button type="submit" disabled={busy} className="btn btn-primary flex-1 font-bold">
                  {busy ? 'جاري الحفظ…' : editId ? 'حفظ التعديلات' : 'نشر الإعلان'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cancelEdit();
                    setShowFormModal(false);
                  }}
                  className="btn btn-secondary"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div>
        {loading ? (
          <div className="card p-12 text-center text-ink-400 text-sm">جارٍ تحميل الإعلانات…</div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center text-ink-400 text-sm">لا توجد إعلانات منشورة حالياً.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((a) => (
              <div
                key={a.id}
                className="card bg-white border border-ink-150 hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {/* Cover image */}
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt={a.title}
                    className="w-full h-36 object-cover flex-shrink-0 cursor-pointer"
                    onClick={() => setActiveDetails(a)}
                  />
                ) : (
                  <div
                    className="w-full h-20 bg-cream-50 flex items-center justify-center flex-shrink-0 text-brand cursor-pointer border-b border-ink-100"
                    onClick={() => setActiveDetails(a)}
                  >
                    <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h2" />
                      <path d="m6 9 12-6v16L6 15" />
                      <path d="M18 9h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
                    </svg>
                  </div>
                )}

                {/* Card body */}
                <div className="p-4 flex flex-col flex-1 gap-2 min-h-0">
                  <span className="pill pill-blue text-[10px] py-0.5 px-2 self-start truncate max-w-full" title={audLabel(a.audience)}>
                    {audLabel(a.audience)}
                  </span>
                  <h3
                    className="font-bold text-ink-900 text-sm leading-snug line-clamp-2 cursor-pointer hover:text-brand transition-colors"
                    onClick={() => setActiveDetails(a)}
                  >
                    {a.title}
                  </h3>
                  <p className="text-xs text-ink-500 line-clamp-2 leading-relaxed flex-1">{a.body}</p>
                  <div className="text-[10px] text-ink-400 mt-auto" dir="ltr">
                    {new Date(a.createdAt).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>

                {/* Actions footer */}
                <div className="flex gap-1.5 p-3 border-t border-ink-100 bg-cream-50/50 flex-shrink-0">
                  <button
                    onClick={() => setActiveDetails(a)}
                    className="btn btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1 flex-1 justify-center"
                    type="button"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    عرض
                  </button>
                  {canManageAnnouncements && <>
                  <button
                    onClick={() => startEdit(a)}
                    className="btn btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1 flex-1 justify-center"
                    type="button"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    تعديل
                  </button>
                  <button
                    onClick={() => del(a.id)}
                    className="btn btn-danger py-1.5 px-2.5 text-xs font-semibold flex items-center justify-center"
                    type="button"
                    title="حذف"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        )}
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
                  className="absolute top-3 right-3 bg-black/65 hover:bg-black/85 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors shadow-md"
                  type="button"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
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
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
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
                <span className="flex items-center gap-1 text-ink-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {new Date(activeDetails.createdAt).toLocaleString('ar')}
                </span>
                <span className="pill pill-blue text-[11px] flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h2" />
                    <path d="m6 9 12-6v16L6 15" />
                    <path d="M18 9h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
                  </svg>
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
