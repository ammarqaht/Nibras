'use client';

import { useEffect, useState } from 'react';
import { useStudent } from '../layout';

type GroupData = {
  group: { id: number; name: string; stage: string } | null;
  supervisor: { id: number; name: string } | null;
  members: { id: number; membershipNo: number; name: string; grade: string }[];
};

export default function StudentGroup() {
  const { user } = useStudent();
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/group')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-20" style={{ color: 'var(--ink-soft)' }}>جارٍ التحميل...</div>;
  }

  if (!data?.group) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-5xl mb-4">👥</p>
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--ink)' }}>الأسرة</h1>
        <p style={{ color: 'var(--ink-soft)' }}>لم تُضَف إلى أسرة بعد. تواصل مع المشرفين.</p>
      </div>
    );
  }

  const { group, supervisor, members } = data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>الأسرة</h1>

      {/* Group card */}
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, var(--blue) 0%, #1a5bb5 100%)' }}>
        <p className="text-xs opacity-70 mb-1">مرحلة {group.stage}</p>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{group.name}</h2>
        <p className="text-sm opacity-75 mt-1">{members.length} عضو</p>
      </div>

      {/* Supervisor */}
      {supervisor && (
        <div className="card p-4">
          <p className="text-xs font-bold mb-3" style={{ color: 'var(--ink-soft)' }}>مشرف الأسرة</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold" style={{ background: 'var(--accent)' }}>
              {supervisor.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold" style={{ color: 'var(--ink)' }}>{supervisor.name}</p>
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>مشرف الأسرة</p>
            </div>
          </div>
        </div>
      )}

      {/* Members */}
      <div className="card">
        <div className="p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <p className="font-bold" style={{ color: 'var(--ink)' }}>أعضاء الأسرة</p>
        </div>
        <div className="divide-y" style={{ '--tw-divide-color': 'var(--line)' } as React.CSSProperties}>
          {members.map((m, i) => {
            const isMe = m.id === user?.id;
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 p-4"
                style={{ background: isMe ? '#EEF3FC' : undefined }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: isMe ? 'var(--blue)' : 'var(--bg-soft)', color: isMe ? '#fff' : 'var(--ink-soft)' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: isMe ? 'var(--blue)' : 'var(--ink)' }}>
                    {m.name}
                    {isMe && <span className="text-xs mr-2 opacity-60">(أنت)</span>}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{m.grade} · عضوية #{m.membershipNo}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
