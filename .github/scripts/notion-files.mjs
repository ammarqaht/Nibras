// يبني فهرس كل ملفات المستودع داخل قاعدة "ملفات المشاريع" في نوشن.
// يقارن ملفات المستودع بالموجود في نوشن: يضيف الجديد، ويؤرشف المحذوف، ولا يلمس الباقي.
import { execSync } from "node:child_process";

const TOKEN   = process.env.NOTION_TOKEN;
const DB      = process.env.NOTION_FILES_DB;
const PROJECT = process.env.NOTION_PROJECT_PAGE;
const REPO    = process.env.GITHUB_REPOSITORY;
const BRANCH  = process.env.GITHUB_REF_NAME || "main";

if (!TOKEN || !DB || !PROJECT) {
  console.error("ناقص NOTION_TOKEN أو NOTION_FILES_DB أو NOTION_PROJECT_PAGE");
  process.exit(1);
}

const MAX_FILES = 1500;
const SKIP_DIR  = /^(node_modules|\.next|dist|build|out|coverage|\.turbo|\.vercel)\//;
const SKIP_FILE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.DS_Store)$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = async (path, method, body) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "Notion-Version": "2022-06-28",
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
    const json = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
    return json;
  }
  throw new Error("فشل الاتصال بنوشن بعد عدة محاولات");
};

// ملفات المستودع المتتبَّعة
const tracked = execSync("git ls-files", { maxBuffer: 1 << 28 })
  .toString().split("\n")
  .filter(Boolean)
  .filter((p) => !SKIP_DIR.test(p) && !SKIP_FILE.test(p));

if (tracked.length > MAX_FILES) {
  console.error(`عدد الملفات ${tracked.length} أكبر من الحد ${MAX_FILES} — عدّل MAX_FILES أو وسّع قائمة التجاهل.`);
  process.exit(1);
}

// الصفوف الموجودة حالياً في نوشن لهذا المشروع
const existing = new Map();
let cursor;
do {
  const page = await api(`databases/${DB}/query`, "POST", {
    filter: { property: "المشروع", relation: { contains: PROJECT } },
    page_size: 100,
    start_cursor: cursor,
  });
  for (const row of page.results) {
    const path = row.properties["المسار"]?.title?.[0]?.plain_text;
    if (path) existing.set(path, row.id);
  }
  cursor = page.has_more ? page.next_cursor : undefined;
} while (cursor);

const current  = new Set(tracked);
const toCreate = tracked.filter((p) => !existing.has(p));
const toArchive = [...existing.keys()].filter((p) => !current.has(p));

const linkFor = (p) =>
  `https://github.com/${REPO}/blob/${BRANCH}/` + p.split("/").map(encodeURIComponent).join("/");

for (const p of toCreate) {
  const slash = p.lastIndexOf("/");
  const name  = slash === -1 ? p : p.slice(slash + 1);
  const dir   = slash === -1 ? "/" : p.slice(0, slash);
  const dot   = name.lastIndexOf(".");
  const ext   = dot > 0 ? name.slice(dot + 1) : "—";
  await api("pages", "POST", {
    parent: { database_id: DB },
    properties: {
      "المسار":  { title: [{ text: { content: p.slice(0, 200) } }] },
      "الملف":   { rich_text: [{ text: { content: name.slice(0, 200) } }] },
      "المجلد":  { rich_text: [{ text: { content: dir.slice(0, 200) } }] },
      "النوع":   { rich_text: [{ text: { content: ext } }] },
      "الرابط":  { url: linkFor(p) },
      "المشروع": { relation: [{ id: PROJECT }] },
    },
  });
  await sleep(340);
}

for (const p of toArchive) {
  await api(`pages/${existing.get(p)}`, "PATCH", { archived: true });
  await sleep(340);
}

console.log(`الفرع: ${BRANCH} | المتتبَّع: ${tracked.length} | أُضيف: ${toCreate.length} | أُرشف: ${toArchive.length}`);
