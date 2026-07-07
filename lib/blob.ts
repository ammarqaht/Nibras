import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

/**
 * File/image storage on Vercel Blob.
 *
 * Historically images were stored as base64 data-URLs directly in Postgres,
 * which bloated every row and slowed list queries + uploads. We now upload the
 * bytes to Vercel Blob and persist only the returned https URL.
 *
 * All helpers here are IDEMPOTENT: a value that is already an https URL (or an
 * empty value) is returned untouched, so the migration script and the live
 * upload paths can share the exact same logic.
 */

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

/** True when Blob is configured. Without a token we keep the raw value (no crash). */
export const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Upload a single data-URL to Blob and return its public URL.
 * - null/empty  → null
 * - http(s) URL → returned unchanged (already migrated)
 * - data: URL   → decoded, uploaded, https URL returned
 * Anything unexpected is returned as-is so we never lose data.
 */
export async function uploadDataUrl(
  value: string | null | undefined,
  prefix: string
): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(value);
  if (!match) return value; // not a data URL — leave untouched

  const mime = (match[1] || 'application/octet-stream').toLowerCase();
  const isBase64 = !!match[2];
  const raw = match[3] || '';

  // Without a Blob token (e.g. local dev before setup) keep the original value.
  if (!hasBlob) return value;

  const buffer = isBase64
    ? Buffer.from(raw, 'base64')
    : Buffer.from(decodeURIComponent(raw), 'utf-8');

  const ext = MIME_EXT[mime] || 'bin';
  const key = `${prefix}/${randomUUID()}.${ext}`;

  const blob = await put(key, buffer, {
    access: 'public',
    contentType: mime,
    addRandomSuffix: false,
  });
  return blob.url;
}

/**
 * Upload a field that holds MANY images (Announcement.images), stored as a JSON
 * array string (or a comma-separated string). Returns a JSON array string of
 * the resulting URLs, or null when empty.
 */
export async function uploadManyDataUrls(
  value: string | null | undefined,
  prefix: string
): Promise<string | null> {
  if (!value) return null;

  let items: string[];
  try {
    const parsed = JSON.parse(value);
    items = Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    items = value.split(',').map(s => s.trim()).filter(Boolean);
  }

  const urls = await Promise.all(items.map(item => uploadDataUrl(item, prefix)));
  const clean = urls.filter((u): u is string => !!u);
  return clean.length ? JSON.stringify(clean) : null;
}
