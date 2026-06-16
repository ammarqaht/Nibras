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
  const [clubLocationMapLink, setClubLocationMapLink] = useState('');
  const [socialWhatsapp, setSocialWhatsapp] = useState('');
  const [socialSnapchat, setSocialSnapchat] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [socialX, setSocialX] = useState('');

  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankOwner, setBankOwner] = useState('');

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
        setLandingIntro(s.landingIntro || 'نادي نبراس هو نادٍ قيمي يهدف إلى تنمية مهارات الطالب عن طريق برامج متنوعة، تجمع بين القيم والثقافة والترفيه بشكل هادف وممتع.');
        setClubTargetGroupValue(s.clubTargetGroupValue || 'الابتدائي العليا – متوسط – ثانوي');
        setClubDatesValue(s.clubDatesValue || 'الثلاثاء 15 محرم – الخميس 9 صفر');
        setClubTimeValue(s.clubTimeValue || '4:00 عصراً – 9:00 مساءً');
        setClubTimeNote(s.clubTimeNote || 'الأحد – الخميس');
        setClubFeesValue(s.clubFeesValue || '300 ريال');
        setClubLocationValue(s.clubLocationValue || 'مقر نادي نبراس');
        setClubLocationNote(s.clubLocationNote || 'اضغط لفتح الخريطة');
        setClubLocationMapLink(s.clubLocationMapLink || '');
        setSocialWhatsapp(s.social_whatsapp || 'https://wa.me/000000000000');
        setSocialSnapchat(s.social_snapchat || 'https://www.snapchat.com/add/nibras');
        setSocialYoutube(s.social_youtube || 'https://www.youtube.com/@nibras');
        setSocialX(s.social_x || 'https://x.com/nibras');
        setBankName(s.bankName || 'مصرف الراجحي');
        setBankAccount(s.bankAccount || '1234567890123456');
        setBankIban(s.bankIban || 'SA1234567890123456789012');
        setBankOwner(s.bankOwner || 'نادي نبراس الصيفي');
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

          <div className="grid grid-cols-1 gap-5 border-t border-ink-100 pt-5 mt-5">
            {/* Google Maps Link */}
            <div>
              <label className="label mb-1.5 block">رابط موقع قوقل ماب (Google Maps Link)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clubLocationMapLink}
                  onChange={e => setClubLocationMapLink(e.target.value)}
                  className="input flex-1 ltr text-left"
                  placeholder="مثال: https://maps.app.goo.gl/... أو https://google.com/maps?..."
                />
                <button
                  onClick={() => handleSaveSetting('clubLocationMapLink', clubLocationMapLink)}
                  disabled={savingKey === 'clubLocationMapLink'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'clubLocationMapLink' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 mt-5">
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

        {/* Social Media Links */}
        <div className="card p-6 bg-white space-y-5">
          <h3 className="font-display text-xl text-ink-900 border-b border-ink-100 pb-3">روابط التواصل الاجتماعي</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Whatsapp */}
            <div>
              <label className="label mb-1.5 block">رابط واتساب (WhatsApp)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={socialWhatsapp}
                  onChange={e => setSocialWhatsapp(e.target.value)}
                  className="input flex-1 ltr text-left"
                  placeholder="https://wa.me/..."
                />
                <button
                  onClick={() => handleSaveSetting('social_whatsapp', socialWhatsapp)}
                  disabled={savingKey === 'social_whatsapp'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'social_whatsapp' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* Snapchat */}
            <div>
              <label className="label mb-1.5 block">رابط سناب شات (Snapchat)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={socialSnapchat}
                  onChange={e => setSocialSnapchat(e.target.value)}
                  className="input flex-1 ltr text-left"
                  placeholder="https://snapchat.com/..."
                />
                <button
                  onClick={() => handleSaveSetting('social_snapchat', socialSnapchat)}
                  disabled={savingKey === 'social_snapchat'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'social_snapchat' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Youtube */}
            <div>
              <label className="label mb-1.5 block">رابط يوتيوب (YouTube)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={socialYoutube}
                  onChange={e => setSocialYoutube(e.target.value)}
                  className="input flex-1 ltr text-left"
                  placeholder="https://youtube.com/..."
                />
                <button
                  onClick={() => handleSaveSetting('social_youtube', socialYoutube)}
                  disabled={savingKey === 'social_youtube'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'social_youtube' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* X */}
            <div>
              <label className="label mb-1.5 block">رابط إكس (X / Twitter)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={socialX}
                  onChange={e => setSocialX(e.target.value)}
                  className="input flex-1 ltr text-left"
                  placeholder="https://x.com/..."
                />
                <button
                  onClick={() => handleSaveSetting('social_x', socialX)}
                  disabled={savingKey === 'social_x'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'social_x' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Transfer Details Card */}
        <div className="card p-6 bg-white space-y-6">
          <h3 className="font-display text-xl text-ink-900 border-b border-ink-100 pb-3">🏦 بيانات الحساب البنكي للتحويل</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Bank Name */}
            <div>
              <label className="label mb-1.5 block">اسم البنك</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="input flex-1"
                  placeholder="مثال: مصرف الراجحي"
                />
                <button
                  onClick={() => handleSaveSetting('bankName', bankName)}
                  disabled={savingKey === 'bankName'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'bankName' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* Account Owner */}
            <div>
              <label className="label mb-1.5 block">اسم صاحب الحساب</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bankOwner}
                  onChange={e => setBankOwner(e.target.value)}
                  className="input flex-1"
                  placeholder="مثال: نادي نبراس الصيفي"
                />
                <button
                  onClick={() => handleSaveSetting('bankOwner', bankOwner)}
                  disabled={savingKey === 'bankOwner'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'bankOwner' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Account Number */}
            <div>
              <label className="label mb-1.5 block">رقم الحساب</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  className="input flex-1 ltr text-left font-mono"
                  placeholder="123456789..."
                />
                <button
                  onClick={() => handleSaveSetting('bankAccount', bankAccount)}
                  disabled={savingKey === 'bankAccount'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'bankAccount' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>

            {/* IBAN */}
            <div>
              <label className="label mb-1.5 block">رقم الآيبان (IBAN)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bankIban}
                  onChange={e => setBankIban(e.target.value)}
                  className="input flex-1 ltr text-left font-mono"
                  placeholder="SA123456..."
                />
                <button
                  onClick={() => handleSaveSetting('bankIban', bankIban)}
                  disabled={savingKey === 'bankIban'}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {savingKey === 'bankIban' ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
