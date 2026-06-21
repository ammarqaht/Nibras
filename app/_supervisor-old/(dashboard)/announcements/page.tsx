'use client';

import { useState, useEffect } from 'react';

type Announcement = {
  id: number;
  title: string;
  body: string;
  audience: string;
  createdAt: string;
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; success: boolean } | null>(null);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supervisor/announcements');
      const data = await res.json();
      if (res.ok) {
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !audience) return;

    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/supervisor/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, audience })
      });
      const data = await res.json();
      if (res.ok) {
        setAnnouncements(prev => [data.announcement, ...prev]);
        setMsg({ text: 'تم نشر الإعلان بنجاح! 📢', success: true });
        setTitle('');
        setBody('');
        setAudience('all');
      } else {
        setMsg({ text: data.error || 'فشل نشر الإعلان ❌', success: false });
      }
    } catch (err) {
      setMsg({ text: 'خطأ في الاتصال بالشبكة ❌', success: false });
    } finally {
      setSubmitting(false);
    }
  };

  const audienceMapAr: Record<string, string> = {
    all: 'الجميع',
    students: 'الطلاب فقط',
    guardians: 'أولياء الأمور فقط'
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900">الإعلانات والرسائل العامة</h1>
        <p className="text-ink-500 mt-2">نشر تعميمات وتنبيهات لطلاب النادي وأولياء أمورهم. تظهر التنبيهات في سجل الإعلانات.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Announcements list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 bg-white space-y-6">
            <h3 className="font-display text-xl text-ink-900">سجل الإعلانات والتعميمات</h3>

            {loading ? (
              <div className="py-12 text-center text-ink-500 text-sm">جاري تحميل سجل الإعلانات…</div>
            ) : announcements.length === 0 ? (
              <div className="py-12 text-center text-ink-400 text-sm">لا توجد إعلانات منشورة بعد.</div>
            ) : (
              <div className="space-y-6 divide-y divide-ink-100 pr-1">
                {announcements.map((a, index) => (
                  <div key={a.id} className={`flex flex-col gap-3 ${index > 0 ? 'pt-6' : ''}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-semibold text-lg text-ink-900">{a.title}</h4>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cream-100 text-ink-600 block mt-1.5 w-max">
                          الجمهور المستهدف: {audienceMapAr[a.audience] || a.audience}
                        </span>
                      </div>
                      <span className="text-[10px] text-ink-400 font-display shrink-0">
                        {new Date(a.createdAt).toLocaleString('ar-SA')}
                      </span>
                    </div>

                    <p className="text-sm text-ink-600 leading-relaxed font-body whitespace-pre-line bg-cream-50/35 p-4 rounded-2xl border border-ink-100/50">
                      {a.body}
                    </p>
                    
                    {/* Delivery channel TODO */}
                    <div className="text-[10px] text-ink-400 italic">
                      💡 القناة الحالية: إشعارات داخل التطبيق. (للتكامل مع قنوات SMS/WhatsApp، يرجى تهيئة بوابة الإرسال الخارجية).
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Publish form */}
        <div className="space-y-6">
          <div className="card p-6 bg-white space-y-4">
            <h3 className="font-display text-xl text-ink-900">نشر إعلان جديد</h3>
            
            {msg && (
              <div className={`p-4 rounded-xl text-xs font-semibold text-center ${msg.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="label mb-1 block">عنوان التعميم / الإعلان</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تغيير في توقيت الأنشطة الرياضية"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="input w-full"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="label mb-1 block">الفئة المستهدفة (الجمهور)</label>
                <select
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  className="input w-full font-semibold"
                  disabled={submitting}
                >
                  <option value="all">الجميع (الطلاب وأولياء الأمور)</option>
                  <option value="students">الطلاب فقط</option>
                  <option value="guardians">أولياء الأمور فقط</option>
                </select>
              </div>

              <div>
                <label className="label mb-1 block">محتوى الإعلان</label>
                <textarea
                  required
                  placeholder="اكتب تفاصيل الإعلان هنا بالتفصيل..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="input w-full h-36 resize-none leading-relaxed"
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full mt-2"
              >
                {submitting ? 'جاري النشر والتعميم…' : 'نشر الإعلان الآن'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
