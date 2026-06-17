'use client';
import { useEffect, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastMsg = { id: number; kind: ToastKind; text: string };

let _id = 0;
const listeners = new Set<(t: ToastMsg) => void>();

export function pushToast(kind: ToastKind, text: string) {
  listeners.forEach((fn) => fn({ id: ++_id, kind, text }));
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const onMsg = (t: ToastMsg) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 3500);
    };
    listeners.add(onMsg);
    return () => {
      listeners.delete(onMsg);
    };
  }, []);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast pointer-events-auto px-5 py-3 rounded-lg shadow-elevated border text-sm font-semibold ${
            t.kind === 'success'
              ? 'bg-[#E7F6EC] border-[#1B7A43]/25 text-[#1B7A43]'
              : t.kind === 'error'
              ? 'bg-nred-50 border-nred/30 text-nred-600'
              : 'bg-white border-ink-200 text-ink-800'
          }`}
        >
          <span className="ml-2">{t.kind === 'success' ? '✓' : t.kind === 'error' ? '✕' : 'ⓘ'}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
