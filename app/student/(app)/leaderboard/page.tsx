'use client';

import { useEffect, useState } from 'react';
import { useStudent } from '../layout';

type LeaderEntry = {
  rank: number;
  registrationId: number;
  studentName: string;
  grade: string;
  rankScore: number;
  balance: number;
};

const RANK_STYLES: Record<number, { bg: string; color: string; icon: string }> = {
  1: { bg: '#FEF3C7', color: '#92400E', icon: '🥇' },
  2: { bg: '#F3F4F6', color: '#374151', icon: '🥈' },
  3: { bg: '#FEE2E2', color: '#7C2D12', icon: '🥉' },
};

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
    return <div className="text-center py-20" style={{ color: 'var(--ink-soft)' }}>جارٍ التحميل...</div>;
  }

  if (disabled) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-5xl mb-4">🏆</p>
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--ink)' }}>ترتيب الطلاب</h1>
        <p className="text-base" style={{ color: 'var(--ink-soft)' }}>
          سيُكشف الترتيب في الوقت المناسب... استمر بالعطاء والمشاركة! 💪
        </p>
      </div>
    );
  }

  const myRank = leaderboard.find(e => e.registrationId === user?.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>ترتيب الطلاب</h1>
        {stage && (
          <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--ink-soft)' }}>
            مرحلة {stage}
          </span>
        )}
      </div>

      {/* My rank highlight */}
      {myRank && (
        <div className="rounded-2xl p-4 mb-5 text-white" style={{ background: 'linear-gradient(135deg, var(--blue) 0%, #1a5bb5 100%)' }}>
          <p className="text-sm opacity-80 mb-1">ترتيبك في مرحلتك</p>
          <div className="flex items-center gap-4">
            <p className="text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>#{myRank.rank}</p>
            <div>
              <p className="font-bold">{myRank.studentName}</p>
              <p className="text-sm opacity-75">{myRank.rankScore} نقطة</p>
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
        <div className="space-y-2">
          {leaderboard.map(entry => {
            const isMe = entry.registrationId === user?.id;
            const rankStyle = RANK_STYLES[entry.rank];
            return (
              <div
                key={entry.registrationId}
                className="card p-4 flex items-center gap-3"
                style={{
                  background: isMe ? '#EEF3FC' : rankStyle ? rankStyle.bg : 'var(--card)',
                  borderColor: isMe ? 'var(--blue)' : undefined,
                  borderWidth: isMe ? 2 : 1,
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                  style={{ background: rankStyle ? 'transparent' : 'var(--bg-soft)', color: rankStyle?.color || 'var(--ink-soft)' }}
                >
                  {rankStyle ? rankStyle.icon : `#${entry.rank}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: isMe ? 'var(--blue)' : 'var(--ink)' }}>
                    {entry.studentName}
                    {isMe && <span className="text-xs mr-2 opacity-60">(أنت)</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{entry.grade}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="font-bold text-sm" style={{ color: 'var(--accent-deep)' }}>{entry.rankScore}</p>
                  <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>نقطة</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
