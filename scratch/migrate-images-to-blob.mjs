/**
 * One-time migration: move base64 data-URL images out of Postgres into Vercel
 * Blob, replacing each column value with the resulting https URL.
 *
 * Run once, AFTER deploying the code that uploads new images to Blob:
 *   node --env-file=.env scratch/migrate-images-to-blob.mjs
 *
 * Requirements in the environment:
 *   DATABASE_URL            (Neon connection string)
 *   BLOB_READ_WRITE_TOKEN   (Vercel Blob token)
 *
 * Idempotent: rows whose value already starts with http(s) are skipped, so the
 * script is safe to re-run.
 */
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

const sql = neon(process.env.DATABASE_URL);

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN is not set. Aborting.');
  process.exit(1);
}

const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
  'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf',
};

async function uploadDataUrl(value, prefix) {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value; // already migrated
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(value);
  if (!match) return value;
  const mime = (match[1] || 'application/octet-stream').toLowerCase();
  const buffer = match[2]
    ? Buffer.from(match[3] || '', 'base64')
    : Buffer.from(decodeURIComponent(match[3] || ''), 'utf-8');
  const ext = MIME_EXT[mime] || 'bin';
  const blob = await put(`${prefix}/${randomUUID()}.${ext}`, buffer, {
    access: 'public', contentType: mime, addRandomSuffix: false,
  });
  return blob.url;
}

// Migrate a single-value column: table."col" holding one data-URL.
async function migrateColumn(table, col, prefix) {
  const rows = await sql(
    `SELECT id, "${col}" AS val FROM "${table}" WHERE "${col}" LIKE 'data:%'`
  );
  console.log(`\n▶ ${table}.${col}: ${rows.length} row(s) to migrate`);
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      const url = await uploadDataUrl(row.val, prefix);
      await sql(`UPDATE "${table}" SET "${col}" = $1 WHERE id = $2`, [url, row.id]);
      ok++;
      process.stdout.write('.');
    } catch (e) {
      fail++;
      console.error(`\n  ! id=${row.id}: ${e.message}`);
    }
  }
  console.log(`\n  ✓ ${ok} migrated, ${fail} failed`);
}

// Migrate a JSON-array column: table."col" holding a JSON array of data-URLs.
async function migrateArrayColumn(table, col, prefix) {
  const rows = await sql(
    `SELECT id, "${col}" AS val FROM "${table}" WHERE "${col}" LIKE '%data:%'`
  );
  console.log(`\n▶ ${table}.${col} (array): ${rows.length} row(s) to migrate`);
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      let items;
      try { const p = JSON.parse(row.val); items = Array.isArray(p) ? p : [String(p)]; }
      catch { items = String(row.val).split(',').map(s => s.trim()).filter(Boolean); }
      const urls = [];
      for (const it of items) urls.push(await uploadDataUrl(it, prefix));
      const clean = urls.filter(Boolean);
      await sql(`UPDATE "${table}" SET "${col}" = $1 WHERE id = $2`,
        [clean.length ? JSON.stringify(clean) : null, row.id]);
      ok++;
      process.stdout.write('.');
    } catch (e) {
      fail++;
      console.error(`\n  ! id=${row.id}: ${e.message}`);
    }
  }
  console.log(`\n  ✓ ${ok} migrated, ${fail} failed`);
}

async function main() {
  console.log('🚀 Migrating base64 images → Vercel Blob');
  await migrateColumn('Registration', 'paymentReceipt', 'receipts');
  await migrateColumn('Announcement', 'imageUrl', 'announcements');
  await migrateArrayColumn('Announcement', 'images', 'announcements');
  await migrateColumn('Invoice', 'imageData', 'invoices');
  await migrateColumn('Task', 'imageUrl', 'tasks');
  await migrateColumn('Submission', 'fileUrl', 'submissions');
  console.log('\n✅ Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
