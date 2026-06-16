'use client';

import { useState } from 'react';
import { form } from '@/content';

export type Coords = { lat: number; lng: number };

/**
 * Optional geolocation field — "تحديد موقعي".
 *
 * NOTE: the prompt asked to reuse the "أضاحي" site's map implementation, but no
 * such site exists in this workspace (no geolocation code anywhere). This is a
 * fresh implementation styled to match the system: browser geolocation +
 * an embedded Google-Maps preview that links out. No API key required.
 */
export default function LocationPicker({
  value,
  onChange
}: {
  value: Coords | null;
  onChange: (c: Coords | null) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setErrMsg('المتصفح لا يدعم تحديد الموقع.');
      return;
    }
    setStatus('locating');
    setErrMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6))
        });
        setStatus('idle');
      },
      (err) => {
        setStatus('error');
        setErrMsg(
          err.code === err.PERMISSION_DENIED
            ? 'تم رفض الإذن بالوصول للموقع. يمكنك تخطّي هذه الخطوة.'
            : 'تعذّر تحديد الموقع. يمكنك المحاولة مرة أخرى أو تخطّيه.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  return (
    <div>
      <p className="hint mb-3">{form.locationNote}</p>

      {!value && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={locate}
          disabled={status === 'locating'}
        >
          {status === 'locating' ? (
            <>
              <Spinner /> {form.locating}
            </>
          ) : (
            <>
              <PinIcon /> {form.locateButton}
            </>
          )}
        </button>
      )}

      {status === 'error' && <p className="err-msg mt-2">{errMsg}</p>}

      {value && (
        <div className="fade-in">
          <div className="flex items-center gap-2 mb-3 text-sm" style={{ color: 'var(--blue)' }}>
            <CheckIcon />
            <span className="font-medium">{form.locationCaptured}</span>
            <span className="text-ink-400" dir="ltr">
              ({value.lat}, {value.lng})
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-ink-200 shadow-soft">
            <iframe
              title="موقع الطالب"
              src={`https://maps.google.com/maps?q=${value.lat},${value.lng}&z=16&output=embed`}
              className="w-full h-56 block"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" className="btn btn-ghost text-sm" onClick={locate}>
              {form.locateAgainButton}
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() => onChange(null)}
              style={{ color: 'var(--red)' }}
            >
              {form.locateClearButton}
            </button>
            <a
              href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost text-sm mr-auto"
            >
              فتح في خرائط Google ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
