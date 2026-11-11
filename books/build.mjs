// Builds NEET PYQ PDFs from the YNeet question bank (GET /api/v1/public/pyq-book):
//   out/NEET-<Subject>-PYQs.pdf          3 full subject books (to sell)
//   out/booklets/<subject>-<chapter>.pdf one booklet per chapter (free downloads)
// Options:
//   --only books|booklets        build just one kind
//   --institute "Name"           cover says "Presented by Name" (institute editions)
//   --logo https://…/logo.png    institute logo on the cover
//   --sample                     use sample.json instead of the API
// Env: YNEET_API (default https://yneet-production.up.railway.app/api/v1), CHROME_PATH, OUT_DIR
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { bookHtml, bookletHtml } from "./template.mjs";

const args = process.argv.slice(2);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const API = (process.env.YNEET_API || "https://yneet-production.up.railway.app/api/v1").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT_DIR || "out");
const only = opt("--only");
const institute = opt("--institute") ? { name: opt("--institute"), logo: opt("--logo") || "" } : null;
const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const instTag = institute ? `-${slug(institute.name).slice(0, 40)}` : "";

async function loadChapters() {
  if (args.includes("--sample")) return JSON.parse(await readFile(new URL("./sample.json", import.meta.url), "utf8")).chapters;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${API}/public/pyq-book`);
      if (!res.ok) throw new Error(`YNeet API responded ${res.status}`);
      return (await res.json()).chapters;
    } catch (e) {
      if (attempt >= 6) throw e;
      console.warn(`${e.message} — retrying in 30 s`);
      await new Promise((r) => setTimeout(r, 30000));
    }
  }
}

// Page numbers in the footer (not on the cover: it has no margin to print into).
const footer = (label) => `<div style="width:100%;font-size:8px;color:#888;padding:0 15mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif">
  <span>${label.replace(/</g, "&lt;")}</span><span><span class="pageNumber"></span></span></div>`;

async function pdf(browser, html, file, label) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.pdf({ path: file, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: footer(label) });
  await page.close();
}

const chapters = await loadChapters();
if (!chapters?.length) throw new Error("No chapters returned");
await mkdir(path.join(OUT, "booklets"), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const summary = [];
// What upload.mjs sends to www.yneet.in (YNeet edition only; institute editions aren't sold).
const manifest = [];
const edition = new Date().toISOString().slice(0, 7);
try {
  const editionNote = `Edition ${edition}.`;
  const credit = institute ? `${institute.name} · powered by YNeet` : "YNeet · www.yneet.in";
  if (only !== "booklets") {
    for (const subject of ["Physics", "Chemistry", "Biology"]) {
      const chs = chapters.filter((c) => c.subject === subject);
      if (!chs.length) continue;
      const file = path.join(OUT, `NEET-${subject}-PYQs${instTag}.pdf`);
      await pdf(browser, bookHtml(subject, chs, { institute, edition: editionNote }), file, `NEET ${subject} PYQs · ${credit}`);
      const n = chs.reduce((a, c) => a + c.questions.length, 0);
      manifest.push({ path: path.relative(OUT, file), name: `neet-${slug(subject)}-pyqs.pdf`, kind: "book", subject, chapters: chs.length, questions: n, edition });
      summary.push(`${path.basename(file)}: ${chs.length} chapters, ${n} questions`);
      console.log(`Book ${subject}: ${chs.length} chapters, ${n} questions`);
    }
  }
  if (only !== "books") {
    for (const c of chapters) {
      const file = path.join(OUT, "booklets", `${slug(c.subject)}-${slug(c.chapter)}${instTag}.pdf`);
      await pdf(browser, bookletHtml(c, { institute }), file, `${c.chapter} · NEET PYQs · ${credit}`);
      manifest.push({ path: path.relative(OUT, file), name: `booklet-${slug(c.subject)}-${slug(c.chapter)}.pdf`.slice(0, 120), kind: "booklet", subject: c.subject, chapter: c.chapter, slug: c.slug, questions: c.questions.length, edition });
    }
    summary.push(`${chapters.length} chapter booklets`);
    console.log(`Booklets: ${chapters.length}`);
  }
} finally {
  await browser.close();
}
await writeFile(path.join(OUT, "SUMMARY.txt"), summary.join("\n") + "\n");
if (!institute) await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
