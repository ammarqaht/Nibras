'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { site, landing, clubDetails, footer, defaultBankDetails, confirmation } from '@/content';

type Field = { key: string; label: string; def: string; type?: 'text' | 'textarea' | 'boolean'; ltr?: boolean };
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
  },
  {
    title: 'إيقاف التسجيل للمراحل الدراسية',
    fields: [
      { key: 'disable_registration_primary', label: 'إيقاف تسجيل المرحلة الابتدائية', def: 'false', type: 'boolean' },
      { key: 'disable_registration_intermediate', label: 'إيقاف تسجيل المرحلة المتوسطة', def: 'false', type: 'boolean' },
      { key: 'disable_registration_secondary', label: 'إيقاف تسجيل المرحلة الثانوية', def: 'false', type: 'boolean' }
    ]
  }
];

export default function SettingsPage() {
  const { user } = useSupervisor();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Reset points modal states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

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

  async function resetPoints() {
    if (resetPassword !== '123asd' || !resetConfirmed) return;
    setResetBusy(true);
    try {
      const r = await fetch('/api/supervisor/reset-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword })
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        pushToast('success', 'تم تصفير جميع نقاط الطلاب وحذف السجل بنجاح.');
        setShowResetModal(false);
        setResetPassword('');
        setResetConfirmed(false);
      } else {
        pushToast('error', j.error || 'تعذّر تصفير النقاط');
      }
    } catch {
      pushToast('error', 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">الإعدادات</h1>
          <p className="text-sm text-ink-500">نصوص الموقع العام، تفاصيل النادي، والحساب البنكي. اتركها فارغة لاستخدام القيمة الافتراضية.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowResetModal(true)}
              className="btn bg-red-600 hover:bg-red-750 text-white font-bold shrink-0"
            >
              تصفير النقاط
            </button>
          )}
          <button onClick={saveAll} disabled={busy || loading} className="btn btn-primary">{busy ? 'جارٍ الحفظ…' : 'حفظ كل التغييرات'}</button>
        </div>
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
                    {f.type === 'boolean' ? (
                      <div className="flex items-center mt-2 h-10 select-none">
                        <input
                          type="checkbox"
                          id={f.key}
                          className="rounded text-brand w-5 h-5 cursor-pointer focus:ring-brand accent-brand"
                          checked={values[f.key] === 'true'}
                          onChange={(e) => set(f.key, e.target.checked ? 'true' : 'false')}
                        />
                        <label htmlFor={f.key} className="mr-2 text-sm text-ink-700 cursor-pointer">
                          موقوف (اكتمال العدد)
                        </label>
                      </div>
                    ) : f.type === 'textarea' ? (
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

          <div className="flex justify-end gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowResetModal(true)}
                className="btn bg-red-600 hover:bg-red-750 text-white font-bold shrink-0"
              >
                تصفير النقاط
              </button>
            )}
            <button onClick={saveAll} disabled={busy} className="btn btn-primary">{busy ? 'جارٍ الحفظ…' : 'حفظ كل التغييرات'}</button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-6" onClick={() => setShowResetModal(false)}>
          <div className="modal-panel w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-ink-150 mb-4">
              <h3 className="text-lg font-bold text-red-600">تنبيه حرج: تصفير نقاط الطلاب</h3>
              <button onClick={() => setShowResetModal(false)} className="text-ink-400 hover:text-ink-900 text-xl font-bold leading-none p-1">×</button>
            </div>
            <div className="space-y-4 text-right" dir="rtl">
              <p className="text-sm text-ink-600 leading-relaxed">
                سيقوم هذا الإجراء بحذف سجل النقاط والرصيد بالكامل لجميع الطلاب وإعادة أرصدتهم ونقاطهم إلى صفر. هذا الإجراء نهائي ولا يمكن التراجع عنه.
              </p>

              <div>
                <label className="label text-sm font-semibold">أدخل كلمة مرور التأكيد (123asd)</label>
                <input
                  type="password"
                  className="field w-full text-left"
                  dir="ltr"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="كلمة المرور"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={resetConfirmed}
                  onChange={e => setResetConfirmed(e.target.checked)}
                  className="rounded border-ink-300 text-red-600 focus:ring-red-500 w-4 h-4 mt-0.5"
                />
                <span className="text-red-600 font-bold leading-normal">
                  أقر برغبتي في تصفير جميع نقاط الطلاب وحذف سجل النقاط بالكامل. هذا الإجراء نهائي ولحالات الطوارئ فقط.
                </span>
              </label>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={resetPoints}
                  disabled={resetBusy || resetPassword !== '123asd' || !resetConfirmed}
                  className="btn bg-red-600 hover:bg-red-750 text-white font-bold flex-1 disabled:opacity-50"
                >
                  {resetBusy ? 'جاري تصفير النقاط...' : 'تأكيد تصفير النقاط'}
                </button>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="btn btn-ghost border border-ink-200 text-ink-700 flex-1"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
