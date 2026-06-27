'use client';

import { useEffect, useState } from 'react';
import { useStudent } from '../context';

type FamilyMember = {
  id: number;
  membershipNo: number;
  name: string;
  grade: string;
  rankScore: number;
  balance: number;
  individual: number;
  collective: number;
};

type FamilyData = {
  group: { id: number; name: string; stage: string } | null;
  supervisor: { id: number; name: string } | null;
  members: FamilyMember[];
  groupTotal: number;
  groupRank: number;
  groupCount: number;
};

const RANK_BADGE: Record<number, { bg: string; color: string; mark: string }> = {
  1: { bg: '#FEF3C7', color: '#92400E', mark: '🥇' },
  2: { bg: '#F1F5F9', color: '#334155', mark: '🥈' },
  3: { bg: '#FEE2E2', color: '#7C2D12', mark: '🥉' },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return parts[0].slice(0, 1) + parts[1].slice(0, 1);
}

export default function StudentFamily() {
  const { user } = useStudent();
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/family')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="skeleton" style={{ height: 140 }} />
        <div className="skeleton" style={{ height: 72 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  if (!data?.group) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-5xl mb-4">👥</p>
        <h1 className="font-display text-2xl font-bold mb-3" style={{ color: 'var(--ink)' }}>الأسرة</h1>
        <p style={{ color: 'var(--ink-soft)' }}>لم يتم إسناد أسرة بعد. تواصل مع المشرفين.</p>
      </div>
    );
  }

  const { group, supervisor, members, groupTotal, groupRank, groupCount } = data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Family hero card */}
      <section>
        <div className="membership-card">
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.18em] uppercase opacity-80 mb-2">الأسرة</p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">{group.name}</h1>
              <p className="text-sm opacity-80 mt-1">مرحلة {group.stage}</p>
            </div>
            <div
              className="rounded-2xl px-3 py-2 text-center"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}
            >
              <p className="text-[10px] opacity-80">ترتيب الأسرة</p>
              <p className="font-display tabular-nums text-xl font-bold">
                #{groupRank}
                <span className="text-xs opacity-70"> / {groupCount}</span>
              </p>
            </div>
          </div>

          <div className="relative mt-7 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-widest opacity-70 mb-1">إجمالي نقاط الأسرة</p>
              <p className="font-display tabular-nums text-3xl font-bold">{groupTotal}</p>
            </div>
            <div className="text-end">
              <p className="text-[11px] opacity-70 mb-1">الأعضاء</p>
              <p className="font-display tabular-nums text-base font-bold">{members.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Supervisor row */}
      {supervisor && (
        <section className="card p-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-display font-bold text-lg shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF9F1C, #E68500)' }}
            aria-hidden
          >
            {initials(supervisor.name)}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] tracking-wide font-medium uppercase" style={{ color: 'var(--ink-soft)' }}>مشرف الأسرة</p>
            <p className="font-display text-base font-bold truncate" style={{ color: 'var(--ink)' }}>{supervisor.name}</p>
          </div>
        </section>
      )}

      {/* Members ranked */}
      <section className="card overflow-hidden">
        <div className="p-4 border-b flex items-baseline justify-between" style={{ borderColor: 'var(--line)' }}>
          <h2 className="font-display text-base font-bold" style={{ color: 'var(--ink)' }}>أعضاء الأسرة</h2>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>مرتّبون حسب النقاط</p>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">🌱</p>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>لا يوجد أعضاء بعد.</p>
          </div>
        ) : (
          <ul>
            {members.map((m, i) => {
              const rank = i + 1;
              const isMe = m.id === user?.id;
              const badge = RANK_BADGE[rank];
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                  style={{
                    borderColor: 'var(--line)',
                    background: isMe ? 'rgba(255,159,28,0.07)' : undefined,
                  }}
                >
                  {/* Rank */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-display tabular-nums font-bold"
                    style={{
                      background: badge ? badge.bg : 'var(--bg-soft)',
                      color: badge ? badge.color : 'var(--ink-soft)',
                    }}
                  >
                    {badge ? badge.mark : `#${rank}`}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0"
                    style={{
                      background: isMe ? 'var(--blue)' : '#F5F3EF',
                      color: isMe ? '#fff' : 'var(--ink-soft)',
                    }}
                    aria-hidden
                  >
                    {initials(m.name)}
                  </div>

                  {/* Name + grade */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold text-sm truncate"
                      style={{ color: isMe ? 'var(--accent-deep)' : 'var(--ink)' }}
                    >
                      {m.name}
                      {isMe && <span className="text-xs mx-2 opacity-70">(أنت)</span>}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                      {m.grade} · <span className="tabular-nums" dir="ltr">#{m.membershipNo}</span>
                    </p>
                  </div>

                  {/* Points */}
                  <div className="text-end shrink-0">
                    <p className="font-display tabular-nums text-base font-bold" style={{ color: 'var(--accent-deep)' }}>
                      {m.rankScore}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>نقطة</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
