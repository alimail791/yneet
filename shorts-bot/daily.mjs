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

// YouTube titles lead with the question itself: students search the words of a
// question ("ball thrown vertically upward 20 m/s maximum height"), and that is
// what Google and YouTube match a Short to. Generic stems ("Which of the
// following is correct?") say nothing, so those fall back to the topic.
const GENERIC = /^(which|what)\s+(one\s+)?of\s+the\s+following|^(match|assertion|statement|consider|read|given below)\b|^(identify|choose|select)\s+the\s+(correct|incorrect|wrong)/i;
function questionTitle(q, head) {
  const suffix = ` | ${head} #shorts`;
  const stem = q.question.replace(/\s+/g, " ").replace(/[<>]/g, "").replace(/[\s:]+$/, "").trim();
  const room = 100 - suffix.length;
  if (!GENERIC.test(stem) && stem.length >= 25) {
    const cut = stem.length <= room ? stem : stem.slice(0, room - 1).replace(/[\s,;:]+\S*$/, "") + "…";
    if (cut.length >= 25) return cut + suffix;
  }
  const t = `${head}: ${q.topic || q.chapter} | 5-second challenge #shorts`;
  return t.length <= 100 ? t : `${head}: ${q.chapter}`.slice(0, 90).replace(/\s+\S*$/, "") + " #shorts";
}

function metaFor(q) {
  const link = `https://www.yneet.in/neet-question/${q.slug}?utm_source=youtube&utm_medium=shorts&utm_campaign=daily_quiz`;
  const chapterLink = `https://www.yneet.in/neet-practice/${q.chapterSlug}?utm_source=youtube&utm_medium=shorts&utm_campaign=daily_quiz`;
  const head = q.pyqYear ? `NEET ${q.pyqYear} ${q.subject} PYQ` : `NEET ${q.subject} MCQ`;
  const title = questionTitle(q, head);
  // The first two lines are what shows above "…more" and in Google's video
  // results, so they carry the search words and the answer link.
  const description = [
    `${head} · ${q.chapter}${q.topic && q.topic !== q.chapter ? ` · ${q.topic}` : ""}. Answer in 5 seconds, then check the explanation:`,
    link,
    "",
    q.question.replace(/\s+/g, " ").trim(),
    "",
    ...q.options.map((o, i) => `(${LETTERS[i]}) ${o}`),
    "",
    "The answer is revealed at the end of the Short. Comment yours first 👇",
    "",
    `More free ${q.chapter} NEET PYQs with answers: ${chapterLink}`,
    q.pyqYear ? `Full NEET ${q.pyqYear} question paper with answers: https://www.yneet.in/neet-question-papers/${q.pyqYear}?utm_source=youtube&utm_medium=shorts&utm_campaign=daily_quiz` : null,
    "",
    "3 NEET questions every day: Physics, Chemistry and Biology. Free NEET mock tests, PYQs and college predictor at https://www.yneet.in",
    "",
    `#NEET #NEET2027 #NEETPYQ #${q.subject} #NEETPreparation #MBBS`,
  ].filter((l) => l !== null).join("\n").slice(0, 5000);
  const tags = [
    "NEET", "NEET 2027", "NEET PYQ", `NEET ${q.subject}`, q.chapter, q.topic, `${q.chapter} NEET questions`,
    q.pyqYear ? `NEET ${q.pyqYear}` : null, q.pyqYear ? `NEET ${q.pyqYear} question paper` : null,
    "NEET preparation", "NEET MCQ", "YNeet", "Raise Academy",
  ].filter((t, i, a) => t && t.length <= 30 && a.indexOf(t) === i);
  // YouTube caps all tags together at 500 characters.
  while (tags.join(",").length > 480) tags.pop();
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
  // Instagram Reels: the site stores the videos and posts each at its time (once Instagram is connected there).
  const igTimes = (process.env.PUBLISH_TIMES_IST || "08:00,13:00,19:00").split(",").map((s) => s.trim());
  for (const [i, r] of results.entries()) {
    try { await sendReel(r, date, igTimes[i] ? publishAtIst(date, igTimes[i]) : null); }
    catch (e) { console.warn(`Instagram Reel not sent for ${r.q.subject}: ${e.message}`); }
  }

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
function reelCaption(q) {
  const head = q.pyqYear ? `NEET ${q.pyqYear} ${q.subject} PYQ` : `NEET ${q.subject} MCQ`;
  return [
    `⏱️ 5-second challenge · ${head} · ${q.chapter}`,
    "",
    q.question.replace(/\s+/g, " ").trim(),
    "",
    ...q.options.map((o, i) => `(${LETTERS[i]}) ${o}`),
    "",
    "Comment your answer 👇 The answer is shown at the end of the reel.",
    "Full explanation and more free PYQs: yneet.in (link in bio)",
    "",
    `#NEET #NEET2027 #NEETPYQ #NEET${q.subject} #NEETPreparation #MBBS #NEETAspirants #YNeet #RaiseAcademy`,
  ].join("\n").slice(0, 2200);
}

async function sendReel(r, date, publishAt) {
  const key = process.env.BOOKS_UPLOAD_KEY;
  if (!key) return;
  const base = (process.env.RAISE_API || "https://raiseacademy-production.up.railway.app/api").replace(/\/$/, "");
  const meta = Buffer.from(JSON.stringify({ date, subject: r.q.subject, chapter: r.q.chapter, caption: reelCaption(r.q), publishAt })).toString("base64");
  const res = await fetch(`${base}/instagram-reels/upload`, { method: "PUT", headers: { "content-type": "video/mp4", "x-upload-key": key, "x-reel-meta": meta }, body: await readFile(r.file) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || `site responded ${res.status}`);
  console.log(`Instagram Reel queued: ${r.q.subject} at ${j.publishAt || "now"}${j.note ? ` (${j.note})` : ""}${j.instagramConnected === false ? " — Instagram not connected yet" : ""}`);
}

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
