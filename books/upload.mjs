// Uploads the YNeet-edition PDFs (out/manifest.json from build.mjs) to the
// Raise Academy API, which serves them on www.yneet.in/neet-pyq-books.
// Env: BOOKS_UPLOAD_URL (default https://raiseacademy-production.up.railway.app/api/books/files),
//      BOOKS_UPLOAD_KEY (same value as the backend's BOOKS_UPLOAD_KEY variable).
import { readFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(process.env.OUT_DIR || "out");
const URL_BASE = (process.env.BOOKS_UPLOAD_URL || "https://raiseacademy-production.up.railway.app/api/books/files").replace(/\/$/, "");
const KEY = process.env.BOOKS_UPLOAD_KEY;
if (!KEY) { console.log("BOOKS_UPLOAD_KEY not set — skipping upload (PDFs are in the run's artifacts)."); process.exit(0); }

const manifest = JSON.parse(await readFile(path.join(OUT, "manifest.json"), "utf8"));
let ok = 0, failed = 0;
for (const m of manifest) {
  const body = await readFile(path.join(OUT, m.path));
  const meta = Buffer.from(JSON.stringify({ kind: m.kind, subject: m.subject, chapter: m.chapter, slug: m.slug, questions: m.questions, chapters: m.chapters, edition: m.edition })).toString("base64");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${URL_BASE}/${encodeURIComponent(m.name)}`, { method: "PUT", headers: { "content-type": "application/pdf", "x-upload-key": KEY, "x-book-meta": meta }, body });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      ok++;
      break;
    } catch (e) {
      if (attempt === 3) { failed++; console.error(`Upload failed for ${m.name}: ${e.message}`); }
      else await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
}
console.log(`Uploaded ${ok}/${manifest.length} PDFs to www.yneet.in${failed ? ` (${failed} failed)` : ""}.`);
if (failed) process.exitCode = 1;
