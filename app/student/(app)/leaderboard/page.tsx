'use client';

import { useEffect, useState } from 'react';
import { useStudent } from '../context';

type LeaderEntry = {
  rank: number;
  registrationId: number;
  studentName: string;
  grade: string;
  rankScore: number;
  balance: number;
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

export default function StudentLeaderboard() {
  const { user } = useStudent();
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [disabled, setDisabled] = useState(false);
  const [stage, setStage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/leaderboard')
      .then(r => r.json())
      .then(d => {
        setDisabled(d.disabled ?? false);
        setLeaderboard(d.leaderboard || []);
        setStage(d.stage || '');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <div className="skeleton" style={{ height: 80 }} />
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 64 }} />)}
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-5xl mb-4">🏆</p>
        <h1 className="font-display text-2xl font-bold mb-3" style={{ color: 'var(--ink)' }}>ترتيب الطلاب</h1>
        <p className="text-base" style={{ color: 'var(--ink-soft)' }}>
          الترتيب غير متاح لمرحلتك حالياً. استمر بالعطاء والمشاركة 💪
        </p>
      </div>
    );
  }

  const myRank = leaderboard.find(e => e.registrationId === user?.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--ink)' }}>الترتيب</h1>
        {stage && (
          <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--ink-soft)' }}>
            مرحلة {stage}
          </span>
        )}
      </header>

      <div className="relative">
        <div style={user?.hidePoints ? { filter: 'blur(10px)', pointerEvents: 'none', userSelect: 'none' } : undefined} className="space-y-5">
          {/* My rank — premium hero */}
          {myRank && (
            <div className="membership-card">
              <div className="relative flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] tracking-[0.18em] uppercase opacity-80 mb-2">ترتيبك في المرحلة</p>
                  <p className="font-display tabular-nums text-5xl font-bold leading-none">
                    #{myRank.rank}
                  </p>
                  <p className="text-sm opacity-85 mt-3">{myRank.studentName}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] tracking-widest opacity-70 mb-1">نقاط الترتيب</p>
                  <p className="font-display tabular-nums text-3xl font-bold">{myRank.rankScore}</p>
                </div>
              </div>
            </div>
          )}

          {leaderboard.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-4xl mb-3">🏅</p>
              <p style={{ color: 'var(--ink-soft)' }}>لا يوجد طلاب في المرحلة بعد.</p>
            </div>
          ) : (
            <ul className="card overflow-hidden">
              {leaderboard.map(entry => {
                const isMe = entry.registrationId === user?.id;
                const badge = RANK_BADGE[entry.rank];
                return (
                  <li
                    key={entry.registrationId}
                    className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                    style={{
                      borderColor: 'var(--line)',
                      background: isMe ? 'rgba(255,159,28,0.07)' : undefined,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-display tabular-nums font-bold"
                      style={{
                        background: badge ? badge.bg : 'var(--bg-soft)',
                        color: badge ? badge.color : 'var(--ink-soft)',
                      }}
                    >
                      {badge ? badge.mark : `#${entry.rank}`}
                    </div>

                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0"
                      style={{
                        background: isMe ? 'var(--blue)' : '#F5F3EF',
                        color: isMe ? '#fff' : 'var(--ink-soft)',
                      }}
                      aria-hidden
                    >
                      {initials(entry.studentName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className="font-bold text-sm truncate"
                        style={{ color: isMe ? 'var(--accent-deep)' : 'var(--ink)' }}
                      >
                        {entry.studentName}
                        {isMe && <span className="text-xs mx-2 opacity-70">(أنت)</span>}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{entry.grade}</p>
                    </div>

                    <div className="text-end shrink-0">
                      <p className="font-display tabular-nums text-base font-bold" style={{ color: 'var(--accent-deep)' }}>
                        {entry.rankScore}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>نقطة</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {user?.hidePoints && (
          <div className="absolute inset-0 flex items-center justify-center p-4 rounded-2xl" style={{ background: 'rgba(250,250,247,0.4)', zIndex: 10 }}>
            <div className="text-center bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-line shadow-xl max-w-sm">
              <p className="text-4xl mb-3">🔒</p>
              <h2 className="font-display text-lg font-bold mb-2" style={{ color: 'var(--ink)' }}>{user.hidePointsTitle || 'الترتيب مخفي مؤقتاً'}</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{user.hidePointsMessage || 'سيتم الكشف عن الترتيب قريباً — استمر في التميّز! 🌟'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
