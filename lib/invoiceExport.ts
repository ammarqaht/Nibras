import { categoryLabel, departmentLabel } from '@/lib/finance';

// The fields the export needs from an invoice. A subset of the full Invoice type
// so both the finance page and any future caller can pass their own shape.
export type ExportInvoice = {
  invoiceNo: number;
  title: string;
  vendor: string | null;
  invoiceDate: string | null;
  category: string | null;
  department: string;
  total: number;
  imageData: string | null;
};

const CURRENCY = 'ر.س';

function money(n: number): string {
  const v = (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${CURRENCY}`;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function extFromUrl(url: string, contentType?: string | null): string {
  const m = url.split('?')[0].match(/\.([a-zA-Z0-9]{3,4})$/);
  if (m) return m[1].toLowerCase();
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  return 'jpg';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Open a print-ready window with every invoice image at full resolution — one
 * per A4 page — plus a cover sheet. The browser's "Save as PDF" then produces
 * the highest-quality file possible (vector Arabic text, native-resolution
 * photos). Images are referenced by their Blob URL, so nothing is re-compressed.
 */
export function openInvoicesPdf(invoices: ExportInvoice[]): number {
  const rows = invoices.filter(i => i.imageData && i.imageData.trim());
  if (rows.length === 0) return 0;

  const grandTotal = rows.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const genDate = new Date().toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  const origin = window.location.origin;

  const pages = rows.map((inv, i) => `
    <section class="page">
      <div class="head">
        <div class="title">${esc(inv.title || 'فاتورة')}</div>
        <div class="no">#${esc(inv.invoiceNo)}</div>
      </div>
      <div class="imgwrap"><img src="${esc(inv.imageData)}" alt="" /></div>
      <div class="amount-band">
        <span class="amount-label">المبلغ الإجمالي</span>
        <span class="amount-value">${money(inv.total)}</span>
      </div>
      <div class="meta">
        <div class="cell"><span class="k">المورّد</span><span class="v">${esc(inv.vendor || '—')}</span></div>
        <div class="cell"><span class="k">التاريخ</span><span class="v">${esc(inv.invoiceDate || '—')}</span></div>
        <div class="cell"><span class="k">التصنيف</span><span class="v">${esc(inv.category ? categoryLabel(inv.category) : '—')}</span></div>
        <div class="cell"><span class="k">القسم</span><span class="v">${esc(departmentLabel(inv.department))}</span></div>
      </div>
      <div class="pagefoot">نادي نبراس · الفواتير · ${i + 1} من ${rows.length}</div>
    </section>`).join('\n');

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الفواتير — نبراس</title>
<style>
  @font-face { font-family:'Thmanyah'; src:url('${origin}/fonts/body/thmanyahsans-Regular.otf') format('opentype'); font-weight:400; font-display:swap; }
  @font-face { font-family:'Thmanyah'; src:url('${origin}/fonts/body/thmanyahsans-Bold.otf') format('opentype'); font-weight:700; font-display:swap; }
  @page { size: A4; margin: 0; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body { margin:0; padding:0; font-family:'Thmanyah',sans-serif; color:#1A1A1A; }
  .cover { width:210mm; height:297mm; display:flex; flex-direction:column; align-items:center; justify-content:center;
    text-align:center; background:linear-gradient(160deg,#103F91,#0C2F6E); color:#fff; page-break-after:always; position:relative; }
  .cover h1 { font-size:34pt; font-weight:700; margin:0 0 6mm; }
  .cover .sub { font-size:13pt; opacity:.85; margin-bottom:16mm; }
  .cover .stats { display:flex; gap:14mm; }
  .cover .stat .n { font-size:28pt; font-weight:700; line-height:1; }
  .cover .stat .l { font-size:11pt; opacity:.8; margin-top:3mm; }
  .cover .date { position:absolute; bottom:16mm; font-size:10pt; opacity:.7; }
  .page { width:210mm; height:297mm; padding:16mm 15mm 12mm; display:flex; flex-direction:column; page-break-after:always; position:relative; }
  .page:last-child { page-break-after:auto; }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:8mm; margin-bottom:6mm; }
  .head .title { font-size:19pt; font-weight:700; line-height:1.3; flex:1; }
  .head .no { font-size:12pt; color:#E68500; font-weight:700; white-space:nowrap; padding-top:2mm; }
  .imgwrap { flex:1; min-height:0; border:1px solid #E8E4DF; border-radius:4mm; overflow:hidden; background:#F5F3EF;
    display:flex; align-items:center; justify-content:center; padding:3mm; }
  .imgwrap img { max-width:100%; max-height:100%; object-fit:contain; }
  .amount-band { margin-top:6mm; background:linear-gradient(135deg,#E68500,#FF9F1C); color:#fff; border-radius:3mm;
    padding:5mm 7mm; display:flex; align-items:center; justify-content:space-between; }
  .amount-band .amount-label { font-size:12pt; opacity:.9; }
  .amount-band .amount-value { font-size:21pt; font-weight:700; }
  .meta { margin-top:5mm; display:flex; gap:3mm; }
  .meta .cell { flex:1; border:1px solid #E8E4DF; border-radius:3mm; padding:3.5mm 2mm; text-align:center; }
  .meta .k { display:block; font-size:8.5pt; color:#8A8A8A; margin-bottom:1.5mm; }
  .meta .v { display:block; font-size:11pt; font-weight:700; }
  .pagefoot { position:absolute; bottom:7mm; left:15mm; right:15mm; text-align:center; font-size:8pt; color:#B5B0A7; }
</style></head>
<body>
  <div class="cover">
    <h1>الفواتير</h1>
    <div class="sub">نادي نبراس — سجل الفواتير مع صورها</div>
    <div class="stats">
      <div class="stat"><div class="n">${rows.length}</div><div class="l">فاتورة</div></div>
      <div class="stat"><div class="n">${money(grandTotal)}</div><div class="l">إجمالي المبالغ</div></div>
    </div>
    <div class="date">تاريخ الإنشاء: ${esc(genDate)}</div>
  </div>
  ${pages}
  <script>
    window.addEventListener('load', function () {
      var imgs = Array.prototype.slice.call(document.images);
      var pending = imgs.filter(function (i) { return !i.complete; }).length;
      var printed = false;
      function go() {
        if (pending > 0 || printed) return;
        printed = true;
        var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        ready.then(function () { setTimeout(function () { window.focus(); window.print(); }, 150); });
      }
      imgs.forEach(function (i) {
        if (i.complete) return;
        var done = function () { pending--; go(); };
        i.addEventListener('load', done);
        i.addEventListener('error', done);
      });
      go();
      window.addEventListener('afterprint', function () { window.close(); });
    });
  </script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return -1; // popup blocked
  w.document.open();
  w.document.write(html);
  w.document.close();
  return rows.length;
}

/**
 * Download every invoice image as a ZIP of the original files (no
 * re-compression — highest quality available) plus an Arabic index CSV that
 * maps each file to its statement and amount.
 */
export async function downloadInvoicesZip(
  invoices: ExportInvoice[],
  onProgress?: (percent: number) => void,
): Promise<number> {
  const rows = invoices.filter(i => i.imageData && i.imageData.trim());
  if (rows.length === 0) return 0;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const header = ['رقم الفاتورة', 'البيان', 'المورّد', 'التاريخ', 'التصنيف', 'القسم', 'المبلغ (ر.س)', 'اسم الملف'];
  const csvRows: string[] = [];
  const cell = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;

  // Sort the manifest by invoice number for readability.
  const sorted = [...rows].sort((a, b) => a.invoiceNo - b.invoiceNo);
  for (const inv of sorted) {
    try {
      const res = await fetch(inv.imageData as string);
      if (!res.ok) continue;
      const blob = await res.blob();
      const ext = extFromUrl(inv.imageData as string, res.headers.get('content-type'));
      const total = (Number(inv.total) || 0).toFixed(2);
      const fname = `INV-${inv.invoiceNo}_${total}-SAR.${ext}`;
      zip.file(fname, blob);
      csvRows.push([
        inv.invoiceNo, inv.title, inv.vendor || '', inv.invoiceDate || '',
        inv.category ? categoryLabel(inv.category) : '', departmentLabel(inv.department),
        total, fname,
      ].map(cell).join(','));
    } catch {
      // skip a single failed image, keep going
    }
  }

  // UTF-8 BOM so Excel opens the Arabic CSV correctly.
  const csv = '﻿' + [header.map(cell).join(','), ...csvRows].join('\r\n');
  zip.file('الفهرس.csv', csv);

  const out = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    meta => onProgress?.(Math.round(meta.percent)),
  );
  triggerDownload(out, 'Nibras-Invoices-Images.zip');
  return csvRows.length;
}
