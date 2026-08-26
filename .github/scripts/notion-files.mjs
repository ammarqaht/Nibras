// يبني شجرة مجلدات المستودع داخل صفحة نوشن — كل ملف داخل مجلده، واسمه رابط مباشر لقيت هاب.
import { execSync } from "node:child_process";

const TOKEN  = process.env.NOTION_TOKEN;
const PAGE   = process.env.NOTION_FILES_PAGE;
const REPO   = process.env.GITHUB_REPOSITORY;
const BRANCH = process.env.GITHUB_REF_NAME || "main";

if (!TOKEN || !PAGE) {
  console.error("ناقص NOTION_TOKEN أو NOTION_FILES_PAGE");
  process.exit(1);
}

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

const files = execSync("git ls-files", { maxBuffer: 1 << 28 })
  .toString().split("\n").filter(Boolean)
  .filter((p) => !SKIP_DIR.test(p) && !SKIP_FILE.test(p));

// بناء الشجرة من المسارات
const root = { dirs: new Map(), files: [] };
for (const p of files) {
  const parts = p.split("/");
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { dirs: new Map(), files: [] });
    node = node.dirs.get(parts[i]);
  }
  node.files.push({ name: parts[parts.length - 1], path: p });
}

const linkFor = (p) =>
  `https://github.com/${REPO}/blob/${BRANCH}/` + p.split("/").map(encodeURIComponent).join("/");

const countFiles = (n) =>
  n.files.length + [...n.dirs.values()].reduce((s, d) => s + countFiles(d), 0);

const folderBlock = (name, node) => ({
  object: "block",
  type: "toggle",
  toggle: {
    rich_text: [
      { type: "text", text: { content: `${name}/` }, annotations: { bold: true } },
      { type: "text", text: { content: `   ${countFiles(node)}` }, annotations: { color: "gray" } },
    ],
  },
});

const fileBlock = (f) => ({
  object: "block",
  type: "bulleted_list_item",
  bulleted_list_item: {
    rich_text: [{ type: "text", text: { content: f.name, link: { url: linkFor(f.path) } } }],
  },
});

async function writeNode(parentId, node) {
  const dirs = [...node.dirs.entries()].sort((a, b) => a[0].localeCompare(b[0], "en"));
  const fls  = [...node.files].sort((a, b) => a.name.localeCompare(b.name, "en"));
  const children = [...dirs.map(([n, d]) => folderBlock(n, d)), ...fls.map(fileBlock)];
  if (!children.length) return;

  const created = [];
  for (let i = 0; i < children.length; i += 90) {
    const res = await api(`blocks/${parentId}/children`, "PATCH", { children: children.slice(i, i + 90) });
    created.push(...res.results);
    await sleep(340);
  }
  for (let i = 0; i < dirs.length; i++) {
    await writeNode(created[i].id, dirs[i][1]);
  }
}

// امسح محتوى الصفحة القديم
const old = [];
let cursor;
do {
  const q = `blocks/${PAGE}/children?page_size=100` + (cursor ? `&start_cursor=${cursor}` : "");
  const res = await api(q, "GET");
  old.push(...res.results.map((b) => b.id));
  cursor = res.has_more ? res.next_cursor : undefined;
} while (cursor);

for (const id of old) {
  await api(`blocks/${id}`, "DELETE");
  await sleep(340);
}

// رأس الصفحة
await api(`blocks/${PAGE}/children`, "PATCH", {
  children: [{
    object: "block",
    type: "callout",
    callout: {
      icon: { type: "emoji", emoji: "🗂" },
      color: "gray_background",
      rich_text: [
        { type: "text", text: { content: `${REPO}`, link: { url: `https://github.com/${REPO}` } }, annotations: { bold: true } },
        { type: "text", text: { content: `  ·  فرع ${BRANCH}  ·  ${files.length} ملف  ·  آخر تحديث ${new Date().toISOString().slice(0, 10)}` }, annotations: { color: "gray" } },
      ],
    },
  }],
});
await sleep(340);

await writeNode(PAGE, root);
console.log(`تمت كتابة شجرة فيها ${files.length} ملف.`);
