'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { site, landing, clubDetails, footer, defaultBankDetails, confirmation } from '@/content';

type Field = { key: string; label: string; def: string; type?: 'text' | 'textarea'; ltr?: boolean };
type Section = { title: string; fields: Field[] };

const SECTIONS: Section[] = [
  {
    title: 'نصوص الموقع العام',
    fields: [
      { key: 'siteNameAr', label: 'اسم الموقع (عربي)', def: site.nameAr },
      { key: 'siteNameEn', label: 'اسم الموقع (إنجليزي)', def: site.nameEn, ltr: true },
      { key: 'clubNameAr', label: 'اسم النادي', def: site.clubNameAr },
      { key: 'landingTagline', label: 'العنوان العريض', def: landing.tagline },
      { key: 'landingTaglineSub', label: 'العنوان الفرعي', def: landing.taglineSub },
      { key: 'landingIntro', label: 'مقدمة النادي (التعريف)', def: landing.intro, type: 'textarea' }
    ]
  },
  {
    title: 'تفاصيل النادي',
    fields: [
      { key: 'clubTargetGroupValue', label: 'الفئة المستهدفة', def: clubDetails.targetGroup.value },
      { key: 'clubDatesValue', label: 'تاريخ النادي', def: clubDetails.dates.value },
      { key: 'clubTimeValue', label: 'وقت النادي', def: clubDetails.time.value },
      { key: 'clubTimeNote', label: 'أيام النادي', def: clubDetails.time.note },
      { key: 'clubFeesValue', label: 'الرسوم المطلوب دفعها', def: clubDetails.fees.value },
      { key: 'clubLocationValue', label: 'اسم الموقع', def: clubDetails.location.value },
      { key: 'clubLocationNote', label: 'ملاحظة الموقع', def: clubDetails.location.note },
      { key: 'clubLocationMapLink', label: 'رابط الخريطة (قوقل ماب)', def: clubDetails.location.mapsLink, ltr: true }
    ]
  },
  {
    title: 'الحساب البنكي (للتحويل)',
    fields: [
      { key: 'bankName', label: 'اسم البنك', def: defaultBankDetails.bankName },
      { key: 'bankAccount', label: 'رقم الحساب', def: defaultBankDetails.accountNumber, ltr: true },
      { key: 'bankIban', label: 'رقم الآيبان (IBAN)', def: defaultBankDetails.iban, ltr: true },
      { key: 'bankOwner', label: 'اسم صاحب الحساب', def: defaultBankDetails.accountOwner }
    ]
  },
  {
    title: 'روابط التواصل الاجتماعي',
    fields: footer.social.map((s) => ({ key: `social_${s.key}`, label: s.label, def: s.href, ltr: true }))
  },
  {
    title: 'الإشعارات',
    fields: [
      { key: 'confirmationNotices', label: 'الإشعارات', def: confirmation.notices.join('\n'), type: 'textarea' }
    ]
  }
];

export default function SettingsPage() {
  const { user } = useSupervisor();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/supervisor/settings', { cache: 'no-store' });
      const j = await r.json().catch(() => ({ settings: {} }));
      
      // Initialize with default values from content file so fields are not empty
      const defaultValues: Record<string, string> = {};
      SECTIONS.forEach((sec) => {
        sec.fields.forEach((f) => {
          defaultValues[f.key] = f.def;
        });
      });

      setValues({ ...defaultValues, ...(j.settings ?? {}) });
      setLoading(false);
    })();
  }, []);

  const isAdmin = user?.role ? user.role.split(',').map((r) => r.trim()).includes('admin') : false;
  if (user && !isAdmin) {
    return <div className="card p-10 text-center text-ink-500">هذه الصفحة متاحة للمدير العام فقط.</div>;
  }

  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  async function saveAll() {
    setBusy(true);
    const entries = SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, values[f.key] ?? ''] as const);
    const results = await Promise.all(
      entries.map(([key, value]) =>
        fetch('/api/supervisor/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value })
        }).then((r) => r.ok)
      )
    );
    setBusy(false);
    if (results.every(Boolean)) pushToast('success', 'تم حفظ الإعدادات. ستظهر التغييرات في الموقع العام.');
    else pushToast('error', 'تعذّر حفظ بعض الإعدادات');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">الإعدادات</h1>
          <p className="text-sm text-ink-500">نصوص الموقع العام، تفاصيل النادي، والحساب البنكي. اتركها فارغة لاستخدام القيمة الافتراضية.</p>
        </div>
        <button onClick={saveAll} disabled={busy || loading} className="btn btn-primary">{busy ? 'جارٍ الحفظ…' : 'حفظ كل التغييرات'}</button>
      </div>

      {loading ? (
        <div className="card p-16 text-center text-ink-400 text-sm">جارٍ التحميل…</div>
      ) : (
        <div className="space-y-5">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="card p-6">
              <h2 className="text-lg font-bold text-ink-900 mb-4">{sec.title}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sec.fields.map((f) => (
                  <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="label">{f.label}</label>
                    {f.type === 'textarea' ? (
                      <textarea
                        className="field"
                        rows={3}
                        value={values[f.key] ?? ''}
                        placeholder={f.def}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    ) : (
                      <input
                        className="field"
                        dir={f.ltr ? 'ltr' : undefined}
                        value={values[f.key] ?? ''}
                        placeholder={f.def}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button onClick={saveAll} disabled={busy} className="btn btn-primary">{busy ? 'جارٍ الحفظ…' : 'حفظ كل التغييرات'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
