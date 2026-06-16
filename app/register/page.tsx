'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import StageGradeSelect from '@/components/StageGradeSelect';
import LocationPicker, { type Coords } from '@/components/LocationPicker';
import { form } from '@/content';

type Errors = Record<string, string>;

const onlyDigits = (v: string) => v.replace(/\D/g, '');

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [paymentType, setPaymentType] = useState<'now' | 'later'>('later');
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState({
    bankName: 'مصرف الراجحي',
    accountNumber: '1234567890123456',
    iban: 'SA1234567890123456789012',
    accountOwner: 'نادي نبراس الصيفي'
  });

  useEffect(() => {
    // Force browser scroll to top on mount / refresh
    let originalScrollRestoration: string | undefined;
    if (typeof window !== 'undefined' && window.history && 'scrollRestoration' in window.history) {
      originalScrollRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
    }

    const forceScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    forceScroll();

    // Multiple attempts to override Next.js scroll restoration and layout shifts
    const timers = [
      setTimeout(forceScroll, 10),
      setTimeout(forceScroll, 50),
      setTimeout(forceScroll, 100),
      setTimeout(forceScroll, 200),
      setTimeout(forceScroll, 400),
      setTimeout(forceScroll, 800)
    ];

    // Fetch dynamic bank credentials
    fetch('/api/supervisor/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          const s = data.settings;
          setBankInfo({
            bankName: s.bankName || 'مصرف الراجحي',
            accountNumber: s.bankAccount || '1234567890123456',
            iban: s.bankIban || 'SA1234567890123456789012',
            accountOwner: s.bankOwner || 'نادي نبراس الصيفي'
          });
        }
      })
      .catch(() => {});

    return () => {
      if (typeof window !== 'undefined' && window.history && 'scrollRestoration' in window.history && originalScrollRestoration) {
        window.history.scrollRestoration = originalScrollRestoration as any;
      }
      timers.forEach(clearTimeout);
    };
  }, []);

  const [studentName, setStudentName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [mapLink, setMapLink] = useState('');
  const [hasCondition, setHasCondition] = useState<null | boolean>(null);
  const [conditionNote, setConditionNote] = useState('');

  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  function validate(): Errors {
    const e: Errors = {};
    if (studentName.trim().split(/\s+/).filter(Boolean).length < 4)
      e.studentName = 'يرجى إدخال الاسم الرباعي كاملاً (أربعة أسماء).';
    if (nationalId.length !== 10) e.nationalId = 'رقم الهوية يجب أن يتكوّن من 10 أرقام.';
    if (guardianPhone.length < 10) e.guardianPhone = 'أدخل رقم جوال صحيح (10 أرقام).';
    if (studentPhone && studentPhone.length < 10) e.studentPhone = 'رقم الجوال غير مكتمل.';
    if (!stage) e.stage = 'يرجى اختيار المرحلة الدراسية.';
    else if (!grade) e.grade = 'يرجى اختيار الصف.';
    if (!neighborhood.trim()) e.neighborhood = 'يرجى إدخال الحي السكني.';
    if (!coords && !mapLink.trim())
      e.location = 'يرجى تحديد موقعك على الخريطة أو إدخال رابط قوقل ماب الخاص بك.';
    if (hasCondition === null) e.hasCondition = 'يرجى تحديد الإجابة.';
    if (hasCondition === true && !conditionNote.trim())
      e.conditionNote = 'يرجى توضيح نوع الحساسية أو المرض.';
    return e;
  }

  function handleFormSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    setServerError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      document.querySelector('.err-msg')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStep('payment');
    setSubmitted(false); // Reset submitted state for the payment step
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleFinalSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    setServerError('');

    if (paymentType === 'now' && !paymentReceipt) {
      setServerError('يرجى رفع صورة إيصال التحويل البنكي لإكمال التسجيل.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          nationalId,
          guardianPhone,
          studentPhone: studentPhone || null,
          stage,
          grade,
          neighborhood: neighborhood.trim(),
          locationLat: coords?.lat ?? null,
          locationLng: coords?.lng ?? null,
          mapLink: mapLink.trim() || null,
          hasCondition: hasCondition === true,
          conditionNote: hasCondition === true ? conditionNote.trim() : null,
          paymentType,
          paymentReceipt
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(json.error ?? 'تعذّر إتمام التسجيل، حاول مرة أخرى.');
        setBusy(false);
        return;
      }
      try {
        sessionStorage.setItem('nibras_membership', String(json.membershipNo));
      } catch {
        /* ignore */
      }
      router.push(`/confirmation?m=${json.membershipNo}`);
    } catch {
      setServerError('تعذّر الاتصال بالخادم، تحقّق من الاتصال وحاول مجدداً.');
      setBusy(false);
    }
  }

  const compressImage = (file: File, maxDimension: number = 1200, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 20 ميجابايت.');
      return;
    }

    try {
      const compressed = await compressImage(file, 1200, 0.7);
      setPaymentReceipt(compressed);
    } catch (err) {
      console.error('Image compression failed', err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentReceipt(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const showErr = (k: string) => submitted && errors[k];

  return (
    <main className="min-h-screen flex flex-col">
      <SiteHeader showCta={false} />

      <section className="flex-1 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl">
          {step === 'form' ? (
            <>
              <div className="text-center mb-10">
                <h1 className="font-display text-3xl sm:text-4xl text-ink-900">{form.title}</h1>
                <p className="text-ink-500 mt-3">{form.subtitle}</p>
              </div>

              <form onSubmit={handleFormSubmit} noValidate className="card p-6 sm:p-9 space-y-7">
                {/* الاسم الرباعي */}
                <Field label={form.labels.studentName} required error={showErr('studentName')}>
                  <input
                    className={`field ${showErr('studentName') ? 'invalid' : ''}`}
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder={form.placeholders.studentName}
                    autoComplete="name"
                  />
                </Field>

                {/* رقم الهوية */}
                <Field label={form.labels.nationalId} required error={showErr('nationalId')}>
                  <input
                    className={`field ${showErr('nationalId') ? 'invalid' : ''}`}
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    value={nationalId}
                    onChange={(e) => setNationalId(onlyDigits(e.target.value).slice(0, 10))}
                    placeholder={form.placeholders.nationalId}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* جوال ولي الأمر */}
                  <Field label={form.labels.guardianPhone} required error={showErr('guardianPhone')}>
                    <input
                      className={`field ${showErr('guardianPhone') ? 'invalid' : ''}`}
                      dir="ltr"
                      inputMode="tel"
                      maxLength={10}
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(onlyDigits(e.target.value).slice(0, 10))}
                      placeholder={form.placeholders.guardianPhone}
                    />
                  </Field>

                  {/* جوال الطالب (اختياري) */}
                  <Field
                    label={form.labels.studentPhone}
                    optional={form.labels.studentPhoneHint}
                    error={showErr('studentPhone')}
                  >
                    <input
                      className={`field ${showErr('studentPhone') ? 'invalid' : ''}`}
                      dir="ltr"
                      inputMode="tel"
                      maxLength={10}
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(onlyDigits(e.target.value).slice(0, 10))}
                      placeholder={form.placeholders.studentPhone}
                    />
                  </Field>
                </div>

                {/* المرحلة + الصف */}
                <div>
                  <label className="label">
                    {form.labels.stage} <span className="req">*</span>
                  </label>
                  <StageGradeSelect
                    stage={stage}
                    grade={grade}
                    onStageChange={setStage}
                    onGradeChange={setGrade}
                    invalid={submitted}
                  />
                  {showErr('stage') && <p className="err-msg mt-2">{errors.stage}</p>}
                </div>

                {/* الحي السكني */}
                <Field label={form.labels.neighborhood} required error={showErr('neighborhood')}>
                  <input
                    className={`field ${showErr('neighborhood') ? 'invalid' : ''}`}
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder={form.placeholders.neighborhood}
                  />
                </Field>

                {/* الموقع (إجباري) */}
                <div>
                  <label className="label">
                    {form.labels.location} <span className="req">*</span>
                  </label>
                  <LocationPicker value={coords} onChange={setCoords} />
                  
                  <div className="mt-4">
                    <label className="label">رابط موقع قوقل ماب (إذا لم تكن في المنزل)</label>
                    <input
                      type="url"
                      className={`field ${showErr('location') ? 'invalid' : ''}`}
                      placeholder="مثال: https://maps.app.goo.gl/... أو https://google.com/maps?..."
                      value={mapLink}
                      onChange={(e) => setMapLink(e.target.value)}
                      dir="ltr"
                    />
                    <p className="hint mt-2">
                      إذا كنت تقوم بالتسجيل من مكان آخر، يمكنك نسخ رابط موقعك الحالي من تطبيق خرائط Google ولصقه هنا.
                    </p>
                    {showErr('location') && <p className="err-msg mt-2">{errors.location}</p>}
                  </div>
                </div>

                {/* الحساسية / الأمراض */}
                <div>
                  <label className="label">
                    {form.labels.allergy} <span className="req">*</span>
                  </label>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      className={`choice ${hasCondition === false ? 'is-active' : ''}`}
                      onClick={() => setHasCondition(false)}
                    >
                      {form.allergyOptions.no}
                    </button>
                    <button
                      type="button"
                      className={`choice ${hasCondition === true ? 'is-active' : ''}`}
                      onClick={() => setHasCondition(true)}
                    >
                      {form.allergyOptions.yes}
                    </button>
                  </div>
                  {showErr('hasCondition') && <p className="err-msg mt-2">{errors.hasCondition}</p>}

                  {hasCondition === true && (
                    <div className="mt-4 fade-in">
                      <label className="label">
                        {form.labels.allergyDetails} <span className="req">*</span>
                      </label>
                      <textarea
                        className={`field ${showErr('conditionNote') ? 'invalid' : ''}`}
                        rows={3}
                        value={conditionNote}
                        onChange={(e) => setConditionNote(e.target.value)}
                        placeholder={form.placeholders.allergyDetails}
                      />
                      {showErr('conditionNote') && <p className="err-msg mt-1">{errors.conditionNote}</p>}
                    </div>
                  )}
                </div>

                {serverError && (
                  <div className="text-sm rounded-md p-3 border" style={{ color: 'var(--red)', background: '#FDEAE6', borderColor: 'rgba(251,59,30,0.25)' }}>
                    {serverError}
                  </div>
                )}

                <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
                  التالي: طريقة السداد ⬅️
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-10">
                <h1 className="font-display text-3xl sm:text-4xl text-ink-900">طريقة سداد رسوم التسجيل</h1>
                <p className="text-ink-500 mt-3">الرسوم المطلوبة: 300 ريال سعودي</p>
              </div>

              <form onSubmit={handleFinalSubmit} noValidate className="card p-6 sm:p-9 space-y-7">
                {/* Payment Choice Selection */}
                <div className="space-y-4">
                  <label className="label text-base font-semibold block text-center">اختر طريقة السداد المفضلة:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      className={`choice flex flex-col items-center justify-center p-6 text-center h-auto ${paymentType === 'now' ? 'is-active' : ''}`}
                      onClick={() => setPaymentType('now')}
                    >
                      <span className="text-3xl mb-2">💳</span>
                      <span className="font-display text-lg font-bold">الدفع الآن</span>
                      <span className="text-xs mt-1 opacity-80">تحويل بنكي ورفع صورة الإيصال فوراً</span>
                    </button>
                    <button
                      type="button"
                      className={`choice flex flex-col items-center justify-center p-6 text-center h-auto ${paymentType === 'later' ? 'is-active' : ''}`}
                      onClick={() => setPaymentType('later')}
                    >
                      <span className="text-3xl mb-2">⏳</span>
                      <span className="font-display text-lg font-bold">الدفع الآجل</span>
                      <span className="text-xs mt-1 opacity-80">سداد لاحق لدى مقر النادي بعد المراجعة</span>
                    </button>
                  </div>
                </div>

                {/* Pay Now Details */}
                {paymentType === 'now' && (
                  <div className="space-y-5 border-t border-ink-200/60 pt-6 fade-in">
                    <div className="rounded-2xl border border-line bg-cream-50/60 p-5 space-y-3">
                      <h4 className="font-display text-md font-bold text-ink-800 border-b border-line pb-2 mb-2">بيانات الحساب البنكي للتحويل:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-ink-400 block text-xs">اسم البنك:</span>
                          <span className="font-semibold text-ink-900">{bankInfo.bankName}</span>
                        </div>
                        <div>
                          <span className="text-ink-400 block text-xs">اسم صاحب الحساب:</span>
                          <span className="font-semibold text-ink-900">{bankInfo.accountOwner}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-ink-400 block text-xs">رقم الحساب:</span>
                          <span className="font-mono font-semibold text-ink-900 select-all" dir="ltr">{bankInfo.accountNumber}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-ink-400 block text-xs">الآيبان IBAN:</span>
                          <span className="font-mono font-semibold text-ink-900 select-all" dir="ltr">{bankInfo.iban}</span>
                        </div>
                      </div>
                    </div>

                    {/* Receipt Upload */}
                    <div className="space-y-3">
                      <label className="label font-semibold">صورة إيصال التحويل البنكي <span className="req">*</span></label>
                      
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-ink-200 rounded-2xl p-6 bg-white hover:border-accent transition-colors duration-200 relative group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={busy}
                        />
                        {paymentReceipt ? (
                          <div className="text-center space-y-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={paymentReceipt}
                              alt="إيصال التحويل"
                              className="max-h-48 rounded-xl object-contain mx-auto border border-line"
                            />
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentReceipt(null);
                              }}
                            >
                              🗑️ إزالة الصورة وتغييرها
                            </button>
                          </div>
                        ) : (
                          <div className="text-center space-y-2 pointer-events-none">
                            <span className="text-4xl text-ink-300 group-hover:scale-110 transition-transform duration-200 inline-block">📸</span>
                            <span className="block font-medium text-sm text-ink-700">اضغط لرفع صورة الإيصال</span>
                            <span className="block text-xs text-ink-400">يدعم صيغ الصور (PNG, JPG) حتى 5 ميجابايت</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pay Later Details */}
                {paymentType === 'later' && (
                  <div className="border-t border-ink-200/60 pt-6 text-center space-y-3 fade-in">
                    <div className="inline-flex w-14 h-14 rounded-full bg-cream-100 text-ink-700 items-center justify-center text-2xl">
                      ⏳
                    </div>
                    <h4 className="font-display text-lg text-ink-900 font-bold">ملاحظة بشأن الدفع الآجل</h4>
                    <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">
                      عند إتمام التسجيل، سيتم حفظ مقعد الطالب بوضع "غير مسدد". يمكنك سداد الرسوم لاحقاً نقداً أو عبر الشبكة لدى المشرفين في مقر النادي لتفعيل الاشتراك بالكامل.
                    </p>
                  </div>
                )}

                {serverError && (
                  <div className="text-sm rounded-md p-3 border" style={{ color: 'var(--red)', background: '#FDEAE6', borderColor: 'rgba(251,59,30,0.25)' }}>
                    {serverError}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-4 border-t border-ink-100">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setServerError('');
                    }}
                    className="btn btn-secondary w-1/3"
                    disabled={busy}
                  >
                    السابق
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary w-2/3 btn-lg font-bold"
                    disabled={busy}
                  >
                    {busy ? 'جاري إتمام التسجيل...' : 'تأكيد وإتمام التسجيل'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Field({
  label,
  required,
  optional,
  error,
  children
}: {
  label: string;
  required?: boolean;
  optional?: string;
  error?: string | false;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}{' '}
        {required && <span className="req">*</span>}
        {optional && <span className="text-ink-400 font-normal">({optional})</span>}
      </label>
      {children}
      {error && <p className="err-msg">{error}</p>}
    </div>
  );
}
