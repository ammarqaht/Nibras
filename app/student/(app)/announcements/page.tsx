'use client';

import { useEffect, useState } from 'react';

type Announcement = {
  id: number;
  title: string;
  body: string;
  audience: string;
  imageUrl: string | null;
  images: string | null;
  createdAt: string;
};

function parseImages(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) return parsed.filter(x => typeof x === 'string');
  } catch {
    // not JSON — assume CSV
  }
  return images.split(',').map(s => s.trim()).filter(Boolean);
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function StudentAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/announcements-feed')
      .then(r => r.json())
      .then(d => setItems(d.announcements || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--ink)' }}>الإعلانات</h1>
        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          {loading ? '' : `${items.length} ${items.length === 1 ? 'إعلان' : 'إعلانات'}`}
        </span>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-display text-lg font-bold mb-1" style={{ color: 'var(--ink)' }}>لا توجد إعلانات</p>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>سنُعلمك بأي جديد من إدارة النادي.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(a => {
            const imgs = a.imageUrl ? [a.imageUrl, ...parseImages(a.images)] : parseImages(a.images);
            return (
              <article key={a.id} className="card p-5">
                <header className="mb-2">
                  <h2 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>{a.title}</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)', opacity: 0.8 }}>
                    {formatRelative(a.createdAt)}
                  </p>
                </header>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>{a.body}</p>

                {imgs.length > 0 && (
                  <div className={`mt-4 grid gap-2 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {imgs.slice(0, 4).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="w-full rounded-xl object-cover"
                        style={{ maxHeight: imgs.length === 1 ? '20rem' : '12rem' }}
                      />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
