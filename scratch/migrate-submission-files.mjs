/**
 * One-time fix: move base64 that is embedded INSIDE submission fileUrl envelopes
 * (JSON arrays `["data:",...]` and objects `{"files":["data:",...]}`) into Vercel
 * Blob. The first migration only handled bare top-level data URLs, so multi-file
 * / combined submissions were left as base64 — bloating the Submission table.
 *
 *   node --env-file=.env --env-file=.env.local scratch/migrate-submission-files.mjs
 *
 * Idempotent: values already http(s) are passed through.
 */
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

const sql = neon(process.env.DATABASE_URL);
if (!process.env.BLOB_READ_WRITE_TOKEN) { console.error('❌ BLOB_READ_WRITE_TOKEN not set'); process.exit(1); }

const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
  'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf',
};

async function uploadDataUrl(value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(value);
  if (!m) return value;
  const mime = (m[1] || 'application/octet-stream').toLowerCase();
  const buf = m[2] ? Buffer.from(m[3] || '', 'base64') : Buffer.from(decodeURIComponent(m[3] || ''), 'utf-8');
  const blob = await put(`submissions/${randomUUID()}.${MIME_EXT[mime] || 'bin'}`, buf, {
    access: 'public', contentType: mime, addRandomSuffix: false,
  });
  return blob.url;
}

async function transform(fileUrl) {
  const t = (fileUrl || '').trim();
  if (!t || t.startsWith('text:') || t.startsWith('link:') || t === 'ack://confirmed' || t === 'admin://manual-mark') return fileUrl;
  if (t.startsWith('{')) {
    const obj = JSON.parse(t);
    if (Array.isArray(obj.files)) obj.files = (await Promise.all(obj.files.map(uploadDataUrl))).filter(Boolean);
    return JSON.stringify(obj);
  }
  if (t.startsWith('[')) {
    const arr = JSON.parse(t);
    if (Array.isArray(arr)) {
      const urls = (await Promise.all(arr.map(uploadDataUrl))).filter(Boolean);
      return urls.length === 1 ? urls[0] : JSON.stringify(urls);
    }
  }
  return (await uploadDataUrl(fileUrl)) ?? fileUrl;
}

async function main() {
  const rows = await sql.query(
    `SELECT id, "fileUrl" FROM "Submission" WHERE "fileUrl" LIKE $1 OR "fileUrl" LIKE $2 OR "fileUrl" LIKE $3`,
    ['%data:image%', '%data:audio%', '%data:application%']
  );
  console.log(`▶ ${rows.length} submission(s) with embedded base64`);
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      const next = await transform(row.fileUrl);
      if (next !== row.fileUrl) {
        await sql.query(`UPDATE "Submission" SET "fileUrl" = $1 WHERE id = $2`, [next, row.id]);
        ok++; process.stdout.write('.');
      }
    } catch (e) { fail++; console.error(`\n  ! ${row.id}: ${e.message}`); }
  }
  console.log(`\n✅ ${ok} migrated, ${fail} failed`);
}
main().catch(e => { console.error(e); process.exit(1); });
