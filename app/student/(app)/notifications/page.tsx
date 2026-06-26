'use client';

import { useEffect, useState } from 'react';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  relatedTaskId: string | null;
  createdAt: string;
};

export default function StudentNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/notifications')
      .then(r => r.json())
      .then(d => setItems(d.notifications || []))
      .finally(() => setLoading(false));

    // Mark all as read
    fetch('/api/student/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read' }),
    });
  }, []);

  const unread = items.filter(n => !n.isRead).length;

  if (loading) {
    return <div className="text-center py-20" style={{ color: 'var(--ink-soft)' }}>جارٍ التحميل...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>الإشعارات</h1>
        {unread > 0 && (
          <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>
            {unread} جديد
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p style={{ color: 'var(--ink-soft)' }}>لا توجد إشعارات بعد.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const isGraded = n.type === 'student_graded';
            const iconBg = isGraded ? '#f0fdf4' : '#EEF3FC';
            const icon = isGraded ? '✅' : '📋';
            const date = new Date(n.createdAt);
            const timeAgo = formatTimeAgo(date);

            return (
              <div
                key={n.id}
                className="card p-4 flex items-start gap-3"
                style={{ opacity: n.isRead ? 0.75 : 1 }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg" style={{ background: iconBg }}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{n.title}</p>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: 'var(--accent)' }} />
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>{n.body}</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)', opacity: 0.7 }}>{timeAgo}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return date.toLocaleDateString('ar-SA');
}
