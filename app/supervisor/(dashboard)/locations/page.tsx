'use client';

import { useState, useEffect } from 'react';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  stage: string;
  grade: string;
  neighborhood: string;
  locationLat: number | null;
  locationLng: number | null;
  guardianPhone: string;
};

export default function LocationsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/supervisor/students');
        const data = await res.json();
        if (res.ok) {
          const list: Student[] = data.students || [];
          // Filter only students with coordinates
          const filtered = list.filter(s => s.locationLat !== null && s.locationLng !== null);
          setStudents(filtered);
          if (filtered.length > 0) {
            setSelectedStudent(filtered[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const getEmbedSrc = (lat: number, lng: number) => {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  };

  return (
    <div className="space-y-8 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="font-display text-4xl text-ink-900">خرائط مواقع الطلاب</h1>
        <p className="text-ink-500 mt-2">تتبع وفلترة المواقع الجغرافية المسجلة للطلاب لتنظيم رحلات وتوصيل المشتركين.</p>
      </div>

      {/* Main Grid Split */}
      {loading ? (
        <div className="card bg-white flex-1 flex items-center justify-center text-ink-500 font-body">جاري تحميل الخريطة والبيانات…</div>
      ) : students.length === 0 ? (
        <div className="card bg-white flex-1 flex flex-col items-center justify-center text-center gap-3">
          <span className="text-4xl">🗺️</span>
          <h3 className="font-display text-xl text-ink-900">لم يسجل أي طالب موقعه بعد</h3>
          <p className="text-xs text-ink-400">سيتم عرض خريطة المواقع فور قيام الطلاب بتحديد إحداثياتهم أثناء التسجيل.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6">
          
          {/* Right side: List of students with locations */}
          <div className="w-full md:w-80 bg-white border border-ink-200/60 rounded-3xl flex flex-col overflow-hidden shrink-0">
            <div className="p-4 border-b border-ink-100 bg-cream-50/50">
              <span className="font-semibold text-xs text-ink-500">الطلاب المسجلين بموقع ({students.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-ink-100">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`w-full p-4 text-right transition-colors duration-150 flex flex-col gap-1 font-body hover:bg-cream-50/30 ${selectedStudent?.id === s.id ? 'bg-cream-100/40 border-r-4 border-brand font-semibold' : ''}`}
                >
                  <span className="text-sm text-ink-900">{s.studentName}</span>
                  <span className="text-xs text-ink-400">
                    #{s.membershipNo} • {s.neighborhood}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Left side: Map Preview Panel */}
          <div className="flex-1 bg-white border border-ink-200/60 rounded-3xl overflow-hidden flex flex-col">
            {selectedStudent && (
              <>
                {/* Details Bar */}
                <div className="p-5 border-b border-ink-100 bg-cream-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-md text-ink-900">{selectedStudent.studentName}</h3>
                    <p className="text-xs text-ink-500 mt-1">
                      الحي: {selectedStudent.neighborhood} • المرحلة: {selectedStudent.stage} ({selectedStudent.grade})
                    </p>
                  </div>
                  <div className="text-right sm:text-left shrink-0">
                    <span className="text-xs text-ink-400 block">جوال ولي الأمر:</span>
                    <span className="font-semibold text-sm text-ink-800 ltr">{selectedStudent.guardianPhone}</span>
                  </div>
                </div>

                {/* Map Iframe */}
                <div className="flex-1 relative min-h-[20rem]">
                  <iframe
                    title={selectedStudent.studentName}
                    src={getEmbedSrc(selectedStudent.locationLat!, selectedStudent.locationLng!)}
                    className="w-full h-full border-0 absolute inset-0"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
