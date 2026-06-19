/* ============================================================
   NIBRAS — EDITABLE CONTENT / CONFIG
   ------------------------------------------------------------
   Every piece of user-facing copy lives here so it can be changed
   in ONE place without touching components (see prompt §6).
   The club description, details, notices and links WILL change
   later — edit them here.
   ============================================================ */

export const site = {
  nameAr: 'نبراس',
  nameEn: 'Nibras',
  clubNameAr: 'نادي نبراس',
  metaTitle: 'نادي نبراس — اكتشف، جرّب، انطلق',
  metaDescription:
    'نادي نبراس الصيفي — نادٍ قيمي يجمع بين القيم والثقافة والترفيه لتنمية مهارات الطالب. سجّل الآن.',

  logos: {
    lockupHorizontal: '/logos/nibras-lockup-horizontal.png',
    lockupVertical: '/logos/nibras-lockup-vertical.png',
    iconHorizontal: '/logos/nibras-icon-horizontal.png',
    icon: '/logos/nibras-icon.png'
  }
};

/* -------------------- PAGE 1 — التعريف -------------------- */
export const landing = {
  tagline: 'اكتشف – جرّب – انطلق',
  taglineSub: 'مكان واحد يجمع كل شغفك',
  intro:
    'نادي نبراس هو أحد برامج جمعية وثبة لتنمية الشباب والنشء، يهدف إلى تنمية مهارات الطالب عن طريق برامج متنوعة، تجمع بين القيم والثقافة والترفيه بشكل هادف وممتع.',
  ctaPrimary: 'سجّل معنا',
  // Short marquee words shown under the hero (purely decorative).
  marquee: ['قيم', 'ثقافة', 'ترفيه', 'مهارات', 'إبداع', 'انطلق'],

  // The "feeling" tags / why-join cards (creative presentation of the club spirit).
  highlights: [
    { icon: 'discover', title: 'اكتشف', desc: 'برامج متنوعة تفتح للطالب آفاقاً جديدة في القيم والثقافة والترفيه.', color: 'var(--accent)' },
    { icon: 'try', title: 'جرّب', desc: 'تجارب عملية وممتعة تصقل المهارة وتبني الثقة في بيئة آمنة.', color: 'var(--cyan)' },
    { icon: 'learn', title: 'انطلق', desc: 'معارف قيّمة وخبرات جديدة تبني عقل الطالب وتصنع مستقبله.', color: 'var(--red)' }
  ]
};

/* -------------------- CLUB DETAILS (Page 1 cards) -------------------- */
export const clubDetails = {
  targetGroup: {
    label: 'الفئة المستهدفة',
    value: 'الابتدائي العليا – متوسط – ثانوي',
    note: 'الناجحون من ثالث ابتدائي إلى ثالث ثانوي'
  },
  dates: {
    label: 'تاريخ النادي',
    value: '15 محرم – 9 صفر'
  },
  time: {
    label: 'وقت النادي',
    value: '4:00 عصراً – 9:00 مساءً',
    note: 'الأحد – الخميس'
  },
  fees: {
    label: 'الرسوم',
    value: '300 ريال'
  },
  location: {
    label: 'الموقع',
    value: 'مقر نادي نبراس',
    note: 'اضغط لفتح الخريطة',
    // TODO: replace with the real club coordinates.
    lat: 24.7136,
    lng: 46.6753,
    get mapsLink() {
      return `https://www.google.com/maps?q=${this.lat},${this.lng}`;
    },
    get embedSrc() {
      return `https://maps.google.com/maps?q=${this.lat},${this.lng}&z=15&output=embed`;
    }
  }
};

/* -------------------- PAGE 2 — التسجيل (form copy) -------------------- */
export const form = {
  title: 'التسجيل في نادي نبراس',
  subtitle: 'املأ البيانات التالية لإتمام تسجيل الطالب.',

  labels: {
    studentName: 'اسم الطالب الرباعي',
    nationalId: 'رقم هوية الطالب',
    guardianPhone: 'رقم جوال ولي الأمر',
    studentPhone: 'رقم جوال الطالب',
    studentPhoneHint: 'إن وجد',
    stage: 'المرحلة الدراسية التي تم التخرج منها',
    grade: 'الصف',
    neighborhood: 'الحي السكني',
    location: 'موقع المنزل',
    locationOptional: 'يستفاد منه في النقل',
    allergy: 'هل يعاني الطالب من حساسية أو أمراض مزمنة؟',
    allergyDetails: 'ما هي؟'
  },

  placeholders: {
    studentName: 'اكتب اسم الطالب الرباعي هنا',
    nationalId: 'مثال: 1000000000',
    guardianPhone: '05xxxxxxxx',
    studentPhone: '05xxxxxxxx',
    neighborhood: 'اسم الحي',
    allergyDetails: 'اذكر نوع الحساسية أو المرض'
  },

  // Editable helper note for the location field
  locationNote:
    'يستفاد من الموقع في توصيل الابن في الحالات الاستثنائية والطارئة لا سمح الله.',
  locateButton: 'تحديد موقعي',
  locateAgainButton: 'إعادة تحديد الموقع',
  locateClearButton: 'إلغاء الموقع',
  locating: 'جارٍ تحديد الموقع…',
  locationCaptured: 'تم تحديد الموقع',

  allergyOptions: { no: 'لا', yes: 'نعم' },
  submit: 'إتمام التسجيل',
  submitting: 'جارٍ التسجيل…'
};

/* Dependent stage -> grade options (target group starts at 3rd grade). */
export const stages = [
  {
    key: 'ابتدائي',
    label: 'ابتدائي',
    grades: ['ثالث ابتدائي', 'رابع ابتدائي', 'خامس ابتدائي', 'سادس ابتدائي']
  },
  {
    key: 'متوسط',
    label: 'متوسط',
    grades: ['أول متوسط', 'ثاني متوسط', 'ثالث متوسط']
  },
  {
    key: 'ثانوي',
    label: 'ثانوي',
    grades: ['أول ثانوي', 'ثاني ثانوي', 'ثالث ثانوي']
  }
] as const;

/* -------------------- PAGE 3 — الاعتماد (confirmation) -------------------- */
export const confirmation = {
  eyebrow: 'تم التسجيل بنجاح',
  title: 'مرحباً بك في نبراس',
  membershipLabel: 'رقم العضوية',
  noticesTitle: 'تنبيهات مهمة',
  // Editable notices — more will be added later.
  notices: [
    'يرجى حفظ رقم العضوية للاستفادة منه في عرض نقاط الطالب والتحضير.',
    'في حال عدم دفع الرسوم سيتم الاعتذار من الطالب.',
    'يجب الالتزام بالزي الرسمي في النادي.'
  ],
  registerAnother: 'تسجيل طالب آخر',
  backHome: 'العودة للصفحة الرئيسية'
};

/* -------------------- SHARED — footer / social -------------------- */
export const footer = {
  tagline: 'بيئة آمنة.. لجيلٍ واعد وقيم راسخة',
  rights: '© ١٤٤٧هـ نادي نبراس — جميع الحقوق محفوظة',
  // TODO: replace placeholder links with the real association channels.
  social: [
    { key: 'whatsapp', label: 'واتساب', href: 'https://wa.me/966531223515' },
    { key: 'snapchat', label: 'سناب شات', href: 'https://www.snapchat.com/add/wathbah1_sa' },
    { key: 'youtube', label: 'يوتيوب', href: 'https://www.youtube.com/@wathbah1_sa' },
    { key: 'x', label: 'إكس (X)', href: 'https://x.com/wathbah1_sa' }
  ]
};

/* -------------------- MEMBERSHIP NUMBER -------------------- */
export const membership = {
  // Membership number = base + sequential count. Editable here.
  base: 1000
};

/* -------------------- BANK DETAILS -------------------- */
export const defaultBankDetails = {
  bankName: 'مصرف الانماء',
  accountNumber: '68206153287000',
  iban: 'SA7905000068206153287000',
  accountOwner: 'جمعية وثبة لتنمية الشباب والنشء'
};
