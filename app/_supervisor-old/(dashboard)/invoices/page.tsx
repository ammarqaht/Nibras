'use client';

export default function InvoicesPage() {
  return (
    <div className="space-y-8 relative min-h-[500px]">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900">الفواتير والتحصيلات</h1>
        <p className="text-ink-500 mt-2">إصدار الفواتير، متابعة الدفعات، وإرسال إيصالات الدفع الإلكترونية لأولياء الأمور.</p>
      </div>

      {/* Blur Overlay with "Coming Soon" */}
      <div className="absolute inset-x-0 bottom-0 top-[88px] bg-cream-50/40 backdrop-blur-[6px] z-10 flex items-center justify-center rounded-3xl min-h-[400px]">
        <div className="card p-8 sm:p-10 max-w-md text-center bg-white border border-ink-200/60 shadow-xl pop-in m-6">
          <div className="w-16 h-16 rounded-full bg-brand/10 text-brand flex items-center justify-center text-3xl mx-auto mb-4">
            🧾
          </div>
          <h2 className="font-display text-2xl text-ink-900 mb-2">قريباً</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            ميزة الفواتير الإلكترونية، والتقارير المالية، وتتبع الاشتراكات قيد التطوير وستكون متاحة للمشرفين قريباً.
          </p>
        </div>
      </div>

      {/* Mock content behind the blur */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none pointer-events-none opacity-40">
        <div className="card p-6 bg-white space-y-2">
          <span className="text-xs text-ink-400 block">إجمالي التحصيلات</span>
          <span className="text-2xl font-bold text-ink-900 font-display">0.00 ر.س</span>
        </div>
        <div className="card p-6 bg-white space-y-2">
          <span className="text-xs text-ink-400 block">الفواتير المعلقة</span>
          <span className="text-2xl font-bold text-ink-900 font-display">0 فواتير</span>
        </div>
        <div className="card p-6 bg-white space-y-2">
          <span className="text-xs text-ink-400 block">الفواتير المدفوعة</span>
          <span className="text-2xl font-bold text-ink-900 font-display">0 فواتير</span>
        </div>
      </div>
    </div>
  );
}
