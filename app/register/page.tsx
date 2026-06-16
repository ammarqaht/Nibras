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

  useEffect(() => {
    // Force browser scroll to top on mount / refresh
    window.scrollTo(0, 0);
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

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    setServerError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      document.querySelector('.err-msg')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          conditionNote: hasCondition === true ? conditionNote.trim() : null
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

  const showErr = (k: string) => submitted && errors[k];

  return (
    <main className="min-h-screen flex flex-col">
      <SiteHeader showCta={false} />

      <section className="flex-1 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl sm:text-4xl text-ink-900">{form.title}</h1>
            <p className="text-ink-500 mt-3">{form.subtitle}</p>
          </div>

          <form onSubmit={submit} noValidate className="card p-6 sm:p-9 space-y-7">
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
              {busy ? form.submitting : form.submit}
            </button>
          </form>
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
