'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Form states
  const [siteNameAr, setSiteNameAr] = useState('');
  const [siteNameEn, setSiteNameEn] = useState('');
  const [clubNameAr, setClubNameAr] = useState('');
  const [landingTagline, setLandingTagline] = useState('');
  const [landingTaglineSub, setLandingTaglineSub] = useState('');
  const [landingIntro, setLandingIntro] = useState('');
  const [clubTargetGroupValue, setClubTargetGroupValue] = useState('');
  const [clubDatesValue, setClubDatesValue] = useState('');
  const [clubTimeValue, setClubTimeValue] = useState('');
  const [clubTimeNote, setClubTimeNote] = useState('');
  const [clubFeesValue, setClubFeesValue] = useState('');
  const [clubLocationValue, setClubLocationValue] = useState('');
  const [clubLocationNote, setClubLocationNote] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supervisor/settings');
      const data = await res.json();
      if (res.ok && data.settings) {
        const s = data.settings;
        setSiteNameAr(s.siteNameAr || 'نبراس');
        setSiteNameEn(s.siteNameEn || 'Nibras');
        setClubNameAr(s.clubNameAr || 'نادي نبراس');
        setLandingTagline(s.landingTagline || 'اكتشف – جرّب – تعلم');
        setLandingTaglineSub(s.landingTaglineSub || 'مكان واحد يجمع كل شغفك');
        setLandingIntro(s.landingIntro || 'نادي نبراس هو نادٍ قيمي يهدف إلى تنمية مهارات الطالب عن طريق برامج متنوعة، تجمع بين القيم والثقافة والرياضة بشكل هادف وممتع.');
        setClubTargetGroupValue(s.clubTargetGroupValue || 'الابتدائي العليا – متوسط – ثانوي');
        setClubDatesValue(s.clubDatesValue || 'الثلاثاء 15 محرم – الخميس 9 صفر');
        setClubTimeValue(s.clubTimeValue || '4:00 عصراً – 9:00 مساءً');
        setClubTimeNote(s.clubTimeNote || 'الأحد – الخميس');
        setClubFeesValue(s.clubFeesValue || '300 ريال');
        setClubLocationValue(s.clubLocationValue || 'مقر نادي نبراس');
        setClubLocationNote(s.clubLocationNote || 'اضغط لفتح الخريطة');
      }
    } catch (err) {
      console.error('Error fetching settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSetting = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      const res = await fetch('/api/supervisor/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'فشل حفظ الإعداد');
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالشبكة');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-ink-500 font-body">جاري تحميل الإعدادات ومحتوى الموقع…</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900">إدارة محتوى الموقع</h1>
        <p className="text-ink-500 mt-2">تعديل نصوص وتفاصيل صفحة تسجيل الطلاب العامة. تنعكس التعديلات فورياً عند الحفظ.</p>
      </div>

      <div className="space-y-6">
        
        {/* Site Details */}
        <div className="card p-6 bg-white space-y-5">
          <h3 className="font-display text-xl text-ink-900 border-b border-ink-100 pb-3">المعلومات العامة والتعريف</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Site Name Ar */}
            <div>
              <label className="label mb-1.5 block">اسم الموقع (بالعربية)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={siteNameAr}
                  onChange={e => setSiteNameAr(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('siteNameAr', siteNameAr)}
                  disabled={savingKey === 'siteNameAr'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'siteNameAr' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* Site Name En */}
            <div>
              <label className="label mb-1.5 block">اسم الموقع (بالانجليزية)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={siteNameEn}
                  onChange={e => setSiteNameEn(e.target.value)}
                  className="input flex-1 ltr text-left"
                />
                <button
                  onClick={() => handleSaveSetting('siteNameEn', siteNameEn)}
                  disabled={savingKey === 'siteNameEn'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'siteNameEn' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {/* Club Name */}
            <div>
              <label className="label mb-1.5 block">اسم النادي الكامل</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubNameAr}
                  onChange={e => setClubNameAr(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('clubNameAr', clubNameAr)}
                  disabled={savingKey === 'clubNameAr'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubNameAr' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tagline & Intro */}
        <div className="card p-6 bg-white space-y-5">
          <h3 className="font-display text-xl text-ink-900 border-b border-ink-100 pb-3">الشعارات والمقدمة</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Tagline */}
            <div>
              <label className="label mb-1.5 block">شعار النادي الرئيسي (Tagline)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={landingTagline}
                  onChange={e => setLandingTagline(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('landingTagline', landingTagline)}
                  disabled={savingKey === 'landingTagline'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'landingTagline' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* Tagline Sub */}
            <div>
              <label className="label mb-1.5 block">الشعار الفرعي</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={landingTaglineSub}
                  onChange={e => setLandingTaglineSub(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('landingTaglineSub', landingTaglineSub)}
                  disabled={savingKey === 'landingTaglineSub'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'landingTaglineSub' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>

          <div>
            {/* Intro Text */}
            <label className="label mb-1.5 block">مقدمة تعريف النادي (Intro)</label>
            <div className="flex gap-2 items-start">
              <textarea
                value={landingIntro}
                onChange={e => setLandingIntro(e.target.value)}
                className="input flex-1 h-24 resize-none leading-relaxed"
              />
              <button
                onClick={() => handleSaveSetting('landingIntro', landingIntro)}
                disabled={savingKey === 'landingIntro'}
                className="btn btn-primary btn-sm shrink-0 mt-1"
              >
                {savingKey === 'landingIntro' ? '...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>

        {/* Club Info Details (Target, Dates, Fees, Location) */}
        <div className="card p-6 bg-white space-y-5">
          <h3 className="font-display text-xl text-ink-900 border-b border-ink-100 pb-3">بطاقات تفاصيل النادي</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Target Group */}
            <div>
              <label className="label mb-1.5 block">الفئة المستهدفة</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubTargetGroupValue}
                  onChange={e => setClubTargetGroupValue(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('clubTargetGroupValue', clubTargetGroupValue)}
                  disabled={savingKey === 'clubTargetGroupValue'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubTargetGroupValue' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* Dates */}
            <div>
              <label className="label mb-1.5 block">تاريخ إقامة النادي</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubDatesValue}
                  onChange={e => setClubDatesValue(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('clubDatesValue', clubDatesValue)}
                  disabled={savingKey === 'clubDatesValue'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubDatesValue' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Time value */}
            <div>
              <label className="label mb-1.5 block">وقت وتوقيت النادي</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubTimeValue}
                  onChange={e => setClubTimeValue(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('clubTimeValue', clubTimeValue)}
                  disabled={savingKey === 'clubTimeValue'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubTimeValue' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* Time note */}
            <div>
              <label className="label mb-1.5 block">ملاحظة التوقيت (أيام الأسبوع)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubTimeNote}
                  onChange={e => setClubTimeNote(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('clubTimeNote', clubTimeNote)}
                  disabled={savingKey === 'clubTimeNote'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubTimeNote' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Fees */}
            <div>
              <label className="label mb-1.5 block">الرسوم والاشتراك</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubFeesValue}
                  onChange={e => setClubFeesValue(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('clubFeesValue', clubFeesValue)}
                  disabled={savingKey === 'clubFeesValue'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubFeesValue' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* Location Name */}
            <div>
              <label className="label mb-1.5 block">اسم مقر الموقع</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubLocationValue}
                  onChange={e => setClubLocationValue(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('clubLocationValue', clubLocationValue)}
                  disabled={savingKey === 'clubLocationValue'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubLocationValue' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {/* Location Note */}
            <div>
              <label className="label mb-1.5 block">ملاحظة الموقع (الخريطة)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubLocationNote}
                  onChange={e => setClubLocationNote(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => handleSaveSetting('clubLocationNote', clubLocationNote)}
                  disabled={savingKey === 'clubLocationNote'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubLocationNote' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
