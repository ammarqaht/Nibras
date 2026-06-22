'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import { compressImage } from '@/lib/imageUtils';
import StageGradeSelect from '@/components/StageGradeSelect';
import LocationPicker, { type Coords } from '@/components/LocationPicker';
import LandingMotion from '@/components/LandingMotion';
import { form } from '@/content';

type Errors = Record<string, string>;

const CreditCardIcon = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
    <line x1="6" y1="15" x2="10" y2="15" />
    <line x1="14" y1="15" x2="18" y2="15" />
  </svg>
);

const HourglassIcon = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 2h14" />
    <path d="M5 22h14" />
    <path d="M19 2v4c0 3.8-3.1 7-7 7s-7-3.2-7-7V2" />
    <path d="M5 22v-4c0-3.8 3.1-7 7-7s7 3.2 7 7v4" />
  </svg>
);

const CameraIcon = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

const TrashIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const CopyIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const onlyDigits = (v: string) => v.replace(/\D/g, '');

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [paymentType, setPaymentType] = useState<'now' | 'later'>('later');
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState({
    bankName: 'مصرف الانماء',
    accountNumber: '68206153287000',
    iban: 'SA7905000068206153287000',
    accountOwner: 'جمعية وثبة لتنمية الشباب والنشء'
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleCopyText = (text: string, fieldId: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار صورة فقط لإيصال التحويل.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 20 ميجابايت.');
        return;
      }
      try {
        const compressed = await compressImage(file, 200);
        setPaymentReceipt(compressed);
      } catch (err) {
        console.error('Image compression failed', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPaymentReceipt(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

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
            bankName: s.bankName || 'مصرف الانماء',
            accountNumber: s.bankAccount || '68206153287000',
            iban: s.bankIban || 'SA7905000068206153287000',
            accountOwner: s.bankOwner || 'جمعية وثبة لتنمية الشباب والنشء'
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

  // Load persisted form data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nibras_register_form');
      if (saved) {
        let data = null;
        let timestamp = null;
        
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.values) {
            data = parsed.values;
            timestamp = parsed.timestamp;
          } else {
            // Fallback to load old format if exists
            data = parsed;
          }
        } catch {
          // invalid json, ignore
        }

        const fiveMinutes = 5 * 60 * 1000;
        if (timestamp && Date.now() - timestamp > fiveMinutes) {
          localStorage.removeItem('nibras_register_form');
          return;
        }

        if (data) {
          if (data.studentName) setStudentName(data.studentName);
          if (data.nationalId) setNationalId(data.nationalId);
          if (data.guardianPhone) setGuardianPhone(data.guardianPhone);
          if (data.studentPhone) setStudentPhone(data.studentPhone);
          if (data.stage) setStage(data.stage);
          if (data.grade) setGrade(data.grade);
          if (data.neighborhood) setNeighborhood(data.neighborhood);
          if (data.coords) setCoords(data.coords);
          if (data.mapLink) setMapLink(data.mapLink);
          if (data.hasCondition !== undefined) setHasCondition(data.hasCondition);
          if (data.conditionNote) setConditionNote(data.conditionNote);
        }
      }
    } catch (e) {
      console.error('Failed to load persisted form data', e);
    }
  }, []);

  // Save form data to localStorage on change
  useEffect(() => {
    try {
      const hasAnyValue = [
        studentName, nationalId, guardianPhone, studentPhone,
        stage, grade, neighborhood, coords, mapLink, hasCondition, conditionNote
      ].some(val => val !== '' && val !== null && val !== undefined);

      if (!hasAnyValue) {
        return; // Avoid writing empty states to local storage on mount
      }

      const data = {
        studentName,
        nationalId,
        guardianPhone,
        studentPhone,
        stage,
        grade,
        neighborhood,
        coords,
        mapLink,
        hasCondition,
        conditionNote
      };
      const payload = {
        values: data,
        timestamp: Date.now()
      };
      localStorage.setItem('nibras_register_form', JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to persist form data', e);
    }
  }, [studentName, nationalId, guardianPhone, studentPhone, stage, grade, neighborhood, coords, mapLink, hasCondition, conditionNote]);

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

  // Re-validate fields live once the user has clicked submit
  useEffect(() => {
    if (submitted) {
      setErrors(validate());
    }
  }, [
    studentName,
    nationalId,
    guardianPhone,
    studentPhone,
    stage,
    grade,
    neighborhood,
    coords,
    mapLink,
    hasCondition,
    conditionNote,
    submitted
  ]);

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
        sessionStorage.setItem('nibras_student_name', studentName);
        sessionStorage.setItem('nibras_student_stage', stage);
        localStorage.removeItem('nibras_register_form');
      } catch {
        /* ignore */
      }
      router.push(`/confirmation?m=${json.membershipNo}`);
    } catch {
      setServerError('تعذّر الاتصال بالخادم، تحقّق من الاتصال وحاول مجدداً.');
      setBusy(false);
    }
  }


  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 20 ميجابايت.');
      return;
    }

    try {
      const compressed = await compressImage(file, 200);
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
          {/* Step Progress Bar */}
          <div className="reveal-hero flex items-center justify-center max-w-md mx-auto mb-16 select-none relative px-4">
            <div className="flex items-center w-full relative">
              {/* Line Connector Background */}
              <div className="absolute top-[15px] left-0 right-0 h-[3px] bg-ink-200 z-0 rounded-full" />
              {/* Line Connector Active Fill */}
              <div 
                className="absolute top-[15px] right-0 h-[3px] bg-brand z-0 transition-all duration-500 rounded-full" 
                style={{ 
                  width: step === 'payment' ? '50%' : '0%'
                }} 
              />
              
              {/* Step 1 */}
              <div className="flex flex-col items-center relative z-10 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                  step === 'form' 
                    ? 'bg-brand text-white border-brand shadow-[0_0_12px_rgba(255,159,28,0.25)]' 
                    : 'bg-brand text-white border-brand'
                }`}>
                  ١
                </div>
                <span className={`text-xs font-semibold mt-2 absolute whitespace-nowrap top-8 transition-colors duration-300 ${
                  step === 'form' ? 'text-brand-600 font-bold' : 'text-ink-500 font-bold'
                }`}>
                  بيانات الطالب
                </span>
              </div>
              
              {/* Step 2 */}
              <div className="flex flex-col items-center relative z-10 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                  step === 'payment' 
                    ? 'bg-brand text-white border-brand shadow-[0_0_12px_rgba(255,159,28,0.25)]' 
                    : 'bg-white text-ink-300 border-ink-200'
                }`}>
                  ٢
                </div>
                <span className={`text-xs font-semibold mt-2 absolute whitespace-nowrap top-8 transition-colors duration-300 ${
                  step === 'payment' ? 'text-brand-600 font-bold' : 'text-ink-400'
                }`}>
                  طريقة السداد
                </span>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center relative z-10 flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 bg-white text-ink-300 border-ink-200">
                  ٣
                </div>
                <span className="text-xs font-semibold mt-2 absolute whitespace-nowrap top-8 text-ink-400">
                  التأكيد
                </span>
              </div>
            </div>
          </div>

          {step === 'form' ? (
            <div className="fade-in">
              <div className="reveal-hero text-center mb-10">
                <h1 className="font-display text-3xl sm:text-4xl text-ink-900">{form.title}</h1>
                <p className="text-ink-500 mt-3">{form.subtitle}</p>
              </div>

              <form onSubmit={handleFormSubmit} noValidate className="reveal-hero card p-6 sm:p-9 space-y-7">
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
                  <LocationPicker
                    value={coords}
                    onChange={setCoords}
                    mapLink={mapLink}
                    onMapLinkChange={setMapLink}
                  />
                  {showErr('location') && <p className="err-msg mt-2">{errors.location}</p>}
                </div>

                {/* الحساسية / الأمراض */}
                <div>
                  <label className="label">
                    {form.labels.allergy} <span className="req">*</span>
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className={`choice flex-1 py-3 text-center transition-all duration-300 ${
                        hasCondition === false
                          ? '!border-2 !border-brand !bg-brand !text-white font-bold scale-[1.02] shadow-[0_6px_16px_rgba(255,159,28,0.25)]'
                          : 'border-ink-200 bg-white/70 hover:border-brand/40 hover:scale-[1.01]'
                      }`}
                      onClick={() => setHasCondition(false)}
                    >
                      {form.allergyOptions.no}
                    </button>
                    <button
                      type="button"
                      className={`choice flex-1 py-3 text-center transition-all duration-300 ${
                        hasCondition === true
                          ? '!border-2 !border-brand !bg-brand !text-white font-bold scale-[1.02] shadow-[0_6px_16px_rgba(255,159,28,0.25)]'
                          : 'border-ink-200 bg-white/70 hover:border-brand/40 hover:scale-[1.01]'
                      }`}
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

                <button
                  type="submit"
                  disabled={busy}
                  className="btn btn-lg w-full font-bold text-white bg-brand hover:bg-brand-600 hover:shadow-[0_8px_24px_rgba(255,159,28,0.22)] hover:-translate-y-0.5 border-none transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
                >
                  التالي: طريقة السداد
                </button>
              </form>
            </div>
          ) : (
            <div className="fade-in">
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
                      className={`group relative flex items-center gap-4 p-4 sm:p-5 text-right rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 ${
                        paymentType === 'now'
                          ? 'border-nblue bg-white text-nblue shadow-[0_3px_10px_rgba(16,63,145,0.025)]'
                          : 'border-ink-200/40 bg-white/70 backdrop-blur-md text-ink-700 hover:bg-white hover:shadow-[0_3px_10px_rgba(16,63,145,0.015)] hover:border-nblue/30'
                      }`}
                      onClick={() => setPaymentType('now')}
                    >
                      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 ${
                        paymentType === 'now'
                          ? 'bg-nblue text-white border border-nblue shadow-sm'
                          : 'bg-nblue-50 text-nblue border border-nblue-200/60'
                      }`}>
                        <CreditCardIcon className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`font-display text-base sm:text-lg font-bold transition-colors ${paymentType === 'now' ? 'text-nblue' : 'text-ink-900'}`}>الدفع الآن</span>
                        <span className={`text-[11px] sm:text-xs mt-1 transition-colors leading-normal ${paymentType === 'now' ? 'text-nblue/70' : 'text-ink-500 group-hover:text-ink-700'}`}>تحويل بنكي ورفع صورة الإيصال</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`group relative flex items-center gap-4 p-4 sm:p-5 text-right rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 ${
                        paymentType === 'later'
                          ? 'border-nblue bg-white text-nblue shadow-[0_3px_10px_rgba(16,63,145,0.025)]'
                          : 'border-ink-200/40 bg-white/70 backdrop-blur-md text-ink-700 hover:bg-white hover:shadow-[0_3px_10px_rgba(16,63,145,0.015)] hover:border-nblue/30'
                      }`}
                      onClick={() => setPaymentType('later')}
                    >
                      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${
                        paymentType === 'later'
                          ? 'bg-nblue text-white border border-nblue shadow-sm'
                          : 'bg-nblue-50 text-nblue border border-nblue-200/60'
                      }`}>
                        <HourglassIcon className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`font-display text-base sm:text-lg font-bold transition-colors ${paymentType === 'later' ? 'text-nblue' : 'text-ink-900'}`}>الدفع الآجل</span>
                        <span className={`text-[11px] sm:text-xs mt-1 transition-colors leading-normal ${paymentType === 'later' ? 'text-nblue/70' : 'text-ink-500 group-hover:text-ink-700'}`}>التحويل في وقت لاحق</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Pay Now Details */}
                {paymentType === 'now' && (
                  <div className="space-y-5 border-t border-ink-200/60 pt-6 fade-in">
                    
                    {/* Digital Bank Card (styled like homepage details cards) */}
                    <div 
                      className="relative overflow-hidden rounded-2xl p-6 sm:p-7 bg-white/70 backdrop-blur-md border border-ink-200/40 card-transition hover:bg-white hover:shadow-[0_20px_40px_rgba(16,63,145,0.12)] hover:border-nblue/30 shadow-[0_8px_32px_rgba(16,63,145,0.06)] select-none"
                    >
                      {/* Subtle pattern background */}
                      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                      
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-ink-100 pb-4 mb-5">
                        <div>
                          <span className="text-[10px] text-ink-400 block font-bold tracking-widest uppercase">البنك المعتمد</span>
                          <span className="text-base font-bold text-nblue">{bankInfo.bankName}</span>
                        </div>
                        {/* Gold card chip simulation */}
                        <div className="w-10 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 opacity-90 relative overflow-hidden shadow-inner">
                          <div className="absolute inset-x-2 top-0 bottom-0 border-x border-black/10" />
                          <div className="absolute inset-y-2 left-0 right-0 border-y border-black/10" />
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="space-y-4 font-body">
                        {/* Account Owner */}
                        <div>
                          <span className="text-[10px] text-ink-400 block">اسم الحساب المستفيد</span>
                          <span className="text-sm font-semibold text-ink-900">{bankInfo.accountOwner}</span>
                        </div>

                        {/* Account Number */}
                        <div className="flex items-center justify-between gap-3 bg-cream-50/50 rounded-xl px-4 py-2 border border-ink-100 min-w-0">
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] text-ink-400 block">رقم الحساب</span>
                            <span className="font-mono text-xs sm:text-sm tracking-wider text-ink-900 block truncate" dir="ltr">{bankInfo.accountNumber}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(bankInfo.accountNumber, 'account')}
                            className="shrink-0 p-2 rounded-lg bg-white border border-ink-200 hover:border-nblue/40 text-ink-500 hover:text-nblue active:scale-95 transition-all shadow-sm"
                            title="نسخ رقم الحساب"
                          >
                            {copiedField === 'account' ? (
                              <CheckIcon className="w-4 h-4 text-emerald-600 animate-pulse-subtle" />
                            ) : (
                              <CopyIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* IBAN */}
                        <div className="flex items-center justify-between gap-3 bg-cream-50/50 rounded-xl px-4 py-2 border border-ink-100 min-w-0">
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] text-ink-400 block">الآيبان IBAN</span>
                            <span className="font-mono text-[11px] sm:text-sm tracking-normal xs:tracking-wider text-ink-900 block select-all break-all" dir="ltr">{bankInfo.iban}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(bankInfo.iban, 'iban')}
                            className="shrink-0 p-2 rounded-lg bg-white border border-ink-200 hover:border-nblue/40 text-ink-500 hover:text-nblue active:scale-95 transition-all shadow-sm"
                            title="نسخ الآيبان"
                          >
                            {copiedField === 'iban' ? (
                              <CheckIcon className="w-4 h-4 text-emerald-600 animate-pulse-subtle" />
                            ) : (
                              <CopyIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Toast / Copy Feedback Alert */}
                      {copiedField && (
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 bg-nblue text-white text-[10px] sm:text-xs font-bold px-4 py-1.5 rounded-full shadow-lg border border-nblue/30 animate-bounce">
                          تم نسخ البيانات بنجاح! ✓
                        </div>
                      )}
                    </div>

                    {/* Receipt Upload */}
                    <div className="space-y-3">
                      <label className="label font-semibold">صورة إيصال التحويل البنكي <span className="req">*</span></label>
                      
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all duration-300 relative group min-h-[14rem] ${
                          isDragActive 
                            ? 'border-brand bg-brand-50/40 scale-[1.01]' 
                            : 'border-ink-200 bg-white/70 hover:border-brand hover:bg-white shadow-sm'
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptChange}
                          className="absolute inset-0 opacity-0 cursor-pointer z-20"
                          disabled={busy}
                        />
                        {paymentReceipt ? (
                          <div className="text-center space-y-3 z-30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={paymentReceipt}
                              alt="إيصال التحويل"
                              className="max-h-48 rounded-xl object-contain mx-auto border border-line"
                            />
                            <button
                              type="button"
                              className="btn btn-danger btn-sm flex items-center justify-center gap-1.5 mx-auto relative z-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setPaymentReceipt(null);
                              }}
                            >
                              <TrashIcon className="w-4 h-4" />
                              <span>إزالة الصورة وتغييرها</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-center space-y-2 pointer-events-none flex flex-col items-center">
                            <CameraIcon className={`w-10 h-10 transition-transform duration-300 ${isDragActive ? 'text-brand scale-110' : 'text-ink-300 group-hover:scale-110 group-hover:text-brand'}`} />
                            <span className="block font-medium text-sm text-ink-700">
                              {isDragActive ? 'أفلت إيصال التحويل هنا...' : 'اضغط أو اسحب صورة الإيصال هنا لرفعها'}
                            </span>
                            <span className="block text-xs text-ink-400">يدعم صيغ الصور (PNG, JPG) حتى 20 ميجابايت</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pay Later Details */}
                {paymentType === 'later' && (
                  <div className="border-t border-ink-200/60 pt-6 text-center space-y-3 fade-in">
                    <div className="inline-flex w-14 h-14 rounded-full bg-cream-100 text-nblue items-center justify-center">
                      <HourglassIcon className="w-7 h-7" />
                    </div>
                    <h4 className="font-display text-lg text-ink-900 font-bold">ملاحظة بشأن الدفع الآجل</h4>
                    <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">
                      سيعتبر الطالب في حالة الانتظار حتى يتم الدفع عن طريق التحويل أو من خلال مقر النادي
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
                    className="btn btn-secondary w-1/3 transition-all duration-300 hover:border-nblue hover:text-nblue-600"
                    disabled={busy}
                  >
                    السابق
                  </button>
                  <button
                    type="submit"
                    className="btn w-2/3 btn-lg font-bold text-white bg-brand hover:bg-brand-600 hover:shadow-[0_8px_24px_rgba(255,159,28,0.22)] hover:-translate-y-0.5 border-none transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
                    disabled={busy}
                  >
                    {busy ? 'جاري إتمام التسجيل...' : 'إتمام التسجيل'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      <Footer />
      <LandingMotion />
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
