'use client';

import { useState, useEffect } from 'react';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  stage: string;
  grade: string;
  guardianPhone: string;
  studentPhone: string | null;
  hasCondition: boolean;
  conditionNote: string | null;
};

export default function HealthPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/supervisor/students');
        const data = await res.json();
        if (res.ok) {
          // Filter only students who have conditions
          const list: Student[] = data.students || [];
          setStudents(list.filter(s => s.hasCondition));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900 flex items-center gap-3">
          <span>الحالات الصحية والحساسية</span>
          <span className="text-2xl">🚨</span>
        </h1>
        <p className="text-ink-500 mt-2">قائمة بالطلاب الذين أشاروا لوجود حالات صحية أو حساسية أثناء التسجيل، للتنبيه ولسلامة الجميع.</p>
      </div>

      {/* Roster of alerts */}
      {loading ? (
        <div className="card bg-white py-20 text-center text-ink-500 font-body">جاري تحميل الحالات الطبية…</div>
      ) : students.length === 0 ? (
        <div className="card bg-white py-20 text-center text-green-600 font-body flex flex-col items-center justify-center gap-3">
          <span className="text-4xl">💚</span>
          <h3 className="font-display text-xl">لا توجد حالات صحية مسجلة!</h3>
          <p className="text-xs text-ink-400">جميع الطلاب المسجلين بصحة وسلامة ولله الحمد.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {students.map(s => (
            <div key={s.id} className="card p-6 bg-white border-r-4 border-red-500 shadow-md space-y-4">
              {/* Header inside Card */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-lg text-ink-900">{s.studentName}</h3>
                  <p className="text-xs text-ink-400 mt-0.5">{s.stage} — {s.grade}</p>
                </div>
                <span className="font-display text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full">
                  #{s.membershipNo}
                </span>
              </div>

              {/* Description */}
              <div className="p-4 rounded-2xl bg-red-50/50 border border-red-200 text-red-700 text-sm font-semibold leading-relaxed">
                {s.conditionNote || 'لم يتم تحديد التفاصيل'}
              </div>

              {/* Contact numbers */}
              <div className="pt-2 border-t border-ink-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-ink-500 font-body">
                <div>
                  <span className="text-ink-400 block mb-0.5">رقم جوال ولي الأمر:</span>
                  <span className="font-semibold text-ink-800 ltr block text-right">{s.guardianPhone}</span>
                </div>
                <div>
                  <span className="text-ink-400 block mb-0.5">رقم جوال الطالب:</span>
                  <span className="font-semibold text-ink-800 ltr block text-right">{s.studentPhone || 'لا يوجد'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
