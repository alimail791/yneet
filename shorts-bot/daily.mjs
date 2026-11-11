// Daily NEET quiz Shorts for YouTube (run by .github/workflows/daily-shorts.yml).
//   node daily.mjs                 today's 3 questions (IST), render, upload
//   node daily.mjs --date 2026-11-12 --no-upload
//   node daily.mjs --sample --no-upload   uses sample.json, no API needed
// Env: YNEET_API (default https://yneet-production.up.railway.app/api/v1), CHROME_PATH,
//      YT_* (see youtube.mjs), PUBLISH_TIMES_IST (default "08:00,13:00,19:00"),
//      BOOKS_UPLOAD_KEY + RAISE_API: report each upload so www.yneet.in shows it
//      (/neet-quiz-shorts and the question's page) once it's public.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { renderShort } from "./render.mjs";
import { uploadShort, youtubeConfigured } from "./youtube.mjs";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const API = (process.env.YNEET_API || "https://yneet-production.up.railway.app/api/v1").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT_DIR || "out");
const LETTERS = ["A", "B", "C", "D"];

function metaFor(q) {
  const link = `https://www.yneet.in/neet-question/${q.slug}?utm_source=youtube&utm_medium=shorts&utm_campaign=daily_quiz`;
  const chapterLink = `https://www.yneet.in/neet-practice/${q.chapterSlug}?utm_source=youtube&utm_medium=shorts&utm_campaign=daily_quiz`;
  const head = q.pyqYear ? `NEET ${q.pyqYear} ${q.subject} PYQ` : `NEET ${q.subject} MCQ`;
  let title = `${head}: ${q.chapter} | 5-second challenge #shorts`;
  if (title.length > 100) title = `${head}: ${q.chapter}`.slice(0, 90).replace(/\s+\S*$/, "") + " #shorts";
  const description = [
    `${q.question.replace(/\s+/g, " ").trim()}`,
    "",
    ...q.options.map((o, i) => `(${LETTERS[i]}) ${o}`),
    "",
    `Answer and full explanation: ${link}`,
    `More free ${q.chapter} PYQs: ${chapterLink}`,
    "",
    "3 NEET questions every day: Physics, Chemistry and Biology. Free NEET mock tests, PYQs and college predictor at https://www.yneet.in",
    "",
    `#NEET #NEET2027 #NEETPYQ #${q.subject} #NEETPreparation #MBBS`,
  ].join("\n");
  const tags = ["NEET", "NEET 2027", "NEET PYQ", `NEET ${q.subject}`, q.chapter, "NEET preparation", "NEET MCQ", "YNeet", "Raise Academy"].filter((t) => t.length <= 30);
  return { title, description, tags, link };
}

// "08:00" IST on `date` → ISO UTC, or null if already past (then publish now).
function publishAtIst(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Date.parse(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
  return t - Date.now() > 15 * 60 * 1000 ? new Date(t).toISOString() : null;
}

async function main() {
  let date, questions;
  if (flag("--sample")) {
    ({ date, questions } = JSON.parse(await readFile(new URL("./sample.json", import.meta.url), "utf8")));
  } else {
    // Retry for a few minutes: the API may be mid-deploy (502) when the job starts.
    const url = `${API}/public/questions/daily${opt("--date") ? `?date=${opt("--date")}` : ""}`;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`YNeet API responded ${res.status}`);
        ({ date, questions } = await res.json());
        break;
      } catch (e) {
        if (attempt >= 6) throw e;
        console.warn(`${e.message} — retrying in 30 s (${attempt}/5)`);
        await new Promise((r) => setTimeout(r, 30000));
      }
    }
  }
  if (!questions?.length) throw new Error("No questions returned");
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const results = [];
  try {
    for (const q of questions) {
      const file = path.join(OUT, `${date}-${q.subject.toLowerCase()}.mp4`);
      await renderShort(browser, q, file);
      const meta = metaFor(q);
      await writeFile(file.replace(/\.mp4$/, ".json"), JSON.stringify({ ...meta, question: q }, null, 2));
      results.push({ q, file, meta });
      console.log(`Rendered ${path.basename(file)} — ${meta.title}`);
    }
  } finally {
    await browser.close();
  }

  if (flag("--no-upload")) return console.log("Upload skipped (--no-upload).");
  if (!youtubeConfigured()) return console.log("YouTube not connected yet (YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN missing) — videos are in the run's artifacts.");
  // Never upload the same day twice (re-runs, manual tests): skip subjects already on the channel.
  const done = flag("--force") ? [] : await alreadyUploaded(date);
  if (done.length) console.log(`Already uploaded for ${date}: ${done.join(", ")} — skipping (use --force to upload again).`);
  const times = (process.env.PUBLISH_TIMES_IST || "08:00,13:00,19:00").split(",").map((s) => s.trim());
  let failed = 0;
  for (const [i, r] of results.entries()) {
    if (done.includes(r.q.subject)) continue;
    try {
      const publishAt = times[i] ? publishAtIst(date, times[i]) : null;
      const up = await uploadShort(r.file, { ...r.meta, publishAt });
      console.log(`Uploaded ${r.q.subject}: ${up.url} (${up.privacy}${up.publishAt ? `, goes public ${up.publishAt}` : ""})`);
      await reportToSite({ videoId: up.id, subject: r.q.subject, chapter: r.q.chapter, title: r.meta.title, questionSlug: r.q.slug, date, publishAt });
    } catch (e) {
      failed++;
      console.error(`Upload failed for ${r.q.subject}: ${e.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

// Tell www.yneet.in about the upload (best-effort; the video is on YouTube either way).
async function alreadyUploaded(date) {
  const base = (process.env.RAISE_API || "https://raiseacademy-production.up.railway.app/api").replace(/\/$/, "");
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${base}/youtube-shorts/reported?date=${date}`);
      if (res.ok) return (await res.json()).subjects || [];
      if (res.status === 404) return []; // site not deployed with this check yet
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 20000));
  }
  // Can't tell: better to skip a day than to post duplicates.
  throw new Error("Couldn't check which Shorts are already uploaded today; not uploading.");
}

async function reportToSite(info) {
  const key = process.env.BOOKS_UPLOAD_KEY;
  if (!key || !info.videoId) return;
  const base = (process.env.RAISE_API || "https://raiseacademy-production.up.railway.app/api").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/youtube-shorts`, { method: "POST", headers: { "content-type": "application/json", "x-upload-key": key }, body: JSON.stringify(info) });
    if (!res.ok) throw new Error(`${res.status}`);
  } catch (e) {
    console.warn(`Couldn't report ${info.videoId} to www.yneet.in: ${e.message}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
