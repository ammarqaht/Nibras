'use client';

import { useState } from 'react';
import { form } from '@/content';

export type Coords = { lat: number; lng: number };

/**
 * Optional geolocation field — "تحديد موقعي" + "لست في المنزل" button.
 */
export default function LocationPicker({
  value,
  onChange,
  mapLink,
  onMapLinkChange
}: {
  value: Coords | null;
  onChange: (c: Coords | null) => void;
  mapLink?: string;
  onMapLinkChange?: (v: string) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [showMapInput, setShowMapInput] = useState(false);

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
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            className="btn btn-secondary w-full sm:w-auto font-medium"
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

          <button
            type="button"
            className="text-xs font-semibold text-nblue hover:underline focus:outline-none transition-colors duration-200 mt-1.5"
            onClick={() => setShowMapInput((v) => !v)}
          >
            لست في المنزل؟
          </button>
        </div>
      )}

      {status === 'error' && <p className="err-msg mt-2">{errMsg}</p>}

      {/* Google Maps link input — shown when "لست في المنزل" is clicked */}
      {showMapInput && !value && (
        <div className="mt-4 fade-in">
          <label className="label">رابط موقع المنزل (خرائط قوقل)</label>
          <input
            type="url"
            className="field"
            placeholder="مثال: https://maps.app.goo.gl/... أو https://google.com/maps?..."
            value={mapLink || ''}
            onChange={(e) => onMapLinkChange?.(e.target.value)}
            dir="ltr"
          />
          <p className="hint mt-2">
            انسخ موقع المنزل من خرائط قوقل
          </p>
        </div>
      )}

      {value && (
        <div className="rounded-xl p-3 border border-emerald-200/80 bg-emerald-50/60 flex items-center gap-3.5 fade-in shadow-sm">
          {/* Small square map on the right (RTL first child) */}
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-emerald-200 bg-white">
            <iframe
              title="موقع المنزل المصغر"
              src={`https://maps.google.com/maps?q=${value.lat},${value.lng}&z=15&output=embed`}
              className="w-full h-full block border-none"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Coordinates and Actions on the left of the map */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-emerald-800 font-bold">
              <span>📍 تم التقاط موقع المنزل</span>
              <span className="text-emerald-600/90 font-mono tracking-tighter" dir="ltr">
                ({value.lat}, {value.lng})
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-xs mt-0.5">
              <button
                type="button"
                className="text-nblue font-bold hover:underline"
                onClick={locate}
              >
                {form.locateAgainButton}
              </button>
              <button
                type="button"
                className="text-nred font-bold hover:underline"
                onClick={() => onChange(null)}
              >
                {form.locateClearButton}
              </button>
              <a
                href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 font-bold hover:underline mr-auto"
              >
                فتح قوقل ماب ↗
              </a>
            </div>
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
function HomeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3Z" />
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
