'use client';

import { useState, useEffect, useCallback } from 'react';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  stage: string;
  grade: string;
  paymentStatus: string;
};

export default function PaymentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');

  // Toggling status state
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        search,
        paymentStatus: filterPayment
      });
      const res = await fetch(`/api/supervisor/students?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, filterPayment]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const togglePayment = async (studentId: number, currentStatus: string) => {
    setUpdatingId(studentId);
    try {
      const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
      const res = await fetch('/api/supervisor/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: studentId,
          paymentStatus: nextStatus
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(prev => prev.map(s => s.id === studentId ? data.student : s));
      } else {
        alert(data.error || 'فشل تعديل حالة الدفع');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Totals calculations
  const totalCount = students.length;
  const paidCount = students.filter(s => s.paymentStatus === 'paid').length;
  const unpaidCount = totalCount - paidCount;
  const totalCollected = paidCount * 300;
  const totalOutstanding = unpaidCount * 300;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900">المدفوعات والرسوم</h1>
        <p className="text-ink-500 mt-2">متابعة رسوم تسجيل الطلاب وتأكيد الدفع لرسوم الاشتراك (300 ريال لكل طالب).</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Collected */}
        <div className="card p-6 bg-white flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-ink-400 block mb-1">الرسوم المحصلة</span>
            <span className="font-display text-3xl text-green-600 block">{totalCollected.toLocaleString()} ريال</span>
            <span className="text-xs text-ink-500 block mt-2">من {paidCount} طالب</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-xl">
            ✓
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="card p-6 bg-white flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-ink-400 block mb-1">الرسوم غير المحصلة</span>
            <span className="font-display text-3xl text-red-500 block">{totalOutstanding.toLocaleString()} ريال</span>
            <span className="text-xs text-ink-500 block mt-2">من {unpaidCount} طالب</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-xl">
            🚨
          </div>
        </div>

        {/* Paid ratio */}
        <div className="card p-6 bg-white flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-ink-400 block mb-1">نسبة التحصيل</span>
            <span className="font-display text-3xl text-ink-900 block">
              {totalCount ? Math.round((paidCount / totalCount) * 100) : 0}%
            </span>
            <span className="text-xs text-ink-500 block mt-2">من إجمالي الطلاب المسجلين</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            📊
          </div>
        </div>
      </div>

      {/* Filter Options */}
      <div className="card p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-2/3">
          <label className="label mb-1.5 block">بحث بالاسم أو رقم العضوية</label>
          <input
            type="text"
            placeholder="ابحث هنا..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input w-full"
          />
        </div>
        <div className="w-full sm:w-1/3">
          <label className="label mb-1.5 block">تصنيف حالة الدفع</label>
          <select
            value={filterPayment}
            onChange={e => setFilterPayment(e.target.value)}
            className="input w-full"
          >
            <option value="">عرض الكل</option>
            <option value="paid">تم الدفع</option>
            <option value="unpaid">لم يدفع</option>
          </select>
        </div>
      </div>

      {/* Roster list */}
      <div className="card bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-ink-500 font-body">جاري تحميل البيانات…</div>
        ) : students.length === 0 ? (
          <div className="py-20 text-center text-ink-500 font-body">لا يوجد طلاب للتحصيل.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-cream-50/70 border-b border-ink-200/60 text-ink-500 text-xs font-bold">
                  <th className="p-4 pr-6">العضوية</th>
                  <th className="p-4">اسم الطالب</th>
                  <th className="p-4">المرحلة / الصف</th>
                  <th className="p-4">حالة الدفع الحالية</th>
                  <th className="p-4 pl-6 text-left">تعديل الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-cream-50/20">
                    <td className="p-4 pr-6 font-display font-semibold text-ink-500">#{s.membershipNo}</td>
                    <td className="p-4 font-semibold text-ink-900">{s.studentName}</td>
                    <td className="p-4 text-ink-500">{s.stage} - {s.grade}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${s.paymentStatus === 'paid' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {s.paymentStatus === 'paid' ? 'مدفوع' : 'لم يدفع'}
                      </span>
                    </td>
                    <td className="p-4 pl-6 text-left">
                      <button
                        onClick={() => togglePayment(s.id, s.paymentStatus)}
                        disabled={updatingId === s.id}
                        className={`btn btn-sm ${s.paymentStatus === 'paid' ? 'btn-secondary text-red-600 border-red-200 hover:bg-red-50' : 'btn-primary'}`}
                      >
                        {updatingId === s.id ? 'جاري التحديث…' : (s.paymentStatus === 'paid' ? 'إلغاء تأكيد الدفع' : 'تأكيد استلام الرسوم')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
