// مزامنة تذاكر قيت هاب مع قاعدة "المهام" في نوشن — بدون أي مكتبة خارجية.
import { readFile } from "node:fs/promises";

const TOKEN   = process.env.NOTION_TOKEN;
const TASKS   = process.env.NOTION_TASKS_DB;
const PROJECT = process.env.NOTION_PROJECT_PAGE;

if (!TOKEN || !TASKS) {
  console.error("ناقص NOTION_TOKEN أو NOTION_TASKS_DB");
  process.exit(1);
}

const api = async (path, method, body) => {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "Notion-Version": "2022-06-28",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
  return json;
};

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const issue = event.issue;
if (!issue || issue.pull_request) process.exit(0); // التذاكر فقط، لا الـ PRs

const ref    = `${process.env.GITHUB_REPOSITORY}#${issue.number}`;
const closed = issue.state === "closed";

const found = await api(`databases/${TASKS}/query`, "POST", {
  filter: { property: "رقم التذكرة", rich_text: { equals: ref } },
  page_size: 1,
});

const props = {
  "المهمة": { title: [{ text: { content: issue.title.slice(0, 200) } }] },
  "رقم التذكرة": { rich_text: [{ text: { content: ref } }] },
  "رابط قيت هاب": { url: issue.html_url },
};

if (found.results.length) {
  const page = found.results[0];
  const current = page.properties["الحالة"]?.select?.name;
  // لا نلمس الحالة إلا عند الإغلاق أو إعادة الفتح — حتى لا نمسح تقدّمك اليدوي
  if (closed) props["الحالة"] = { select: { name: "مكتملة" } };
  else if (current === "مكتملة") props["الحالة"] = { select: { name: "جارية" } };
  await api(`pages/${page.id}`, "PATCH", { properties: props });
  console.log(`حُدّثت: ${ref}`);
} else {
  props["الحالة"] = { select: { name: closed ? "مكتملة" : "لم تبدأ" } };
  if (PROJECT) props["المشروع"] = { relation: [{ id: PROJECT }] };
  await api("pages", "POST", { parent: { database_id: TASKS }, properties: props });
  console.log(`أُنشئت: ${ref}`);
}
