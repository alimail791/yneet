// Renders one Short: captures the distinct frames of template.mjs with headless
// Chrome, then ffmpeg joins them (static scenes held, the countdown at 30 fps)
// and adds a generated tick-tock + reveal chime (no music, nothing copyrighted).
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pageHtml, TIMELINE, DURATION } from "./template.mjs";

const FPS = 30;
const at = (() => { let t = 0; const o = {}; for (const [k, v] of Object.entries(TIMELINE)) { o[k] = t; t += v; } return o; })();

export async function renderShort(browser, q, outFile) {
  const dir = await mkdtemp(path.join(tmpdir(), "short-"));
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.setContent(pageHtml(q), { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.evaluate(() => window.layout());

    // [time to draw, seconds to hold]
    const shots = [[0.01, TIMELINE.read]];
    const n = Math.round(TIMELINE.countdown * FPS);
    for (let i = 0; i < n; i++) shots.push([at.countdown + i / FPS, 1 / FPS]);
    shots.push([at.reveal + 0.01, TIMELINE.reveal], [at.explain + 0.01, TIMELINE.explain], [at.cta + 0.01, TIMELINE.cta]);

    const list = [];
    for (let i = 0; i < shots.length; i++) {
      const [t, hold] = shots[i];
      await page.evaluate((x) => window.renderAt(x), t);
      const f = path.join(dir, `f${String(i).padStart(4, "0")}.jpg`);
      await page.screenshot({ path: f, type: "jpeg", quality: 92 });
      list.push(`file '${f}'\nduration ${hold.toFixed(4)}`);
    }
    list.push(`file '${path.join(dir, `f${String(shots.length - 1).padStart(4, "0")}.jpg`)}'`); // concat needs the last frame twice
    await page.close();
    const listFile = path.join(dir, "frames.txt");
    await writeFile(listFile, list.join("\n"));

    // Sound: soft pad, a tick each countdown second, a chime on the reveal.
    const ticks = Array.from({ length: TIMELINE.countdown }, (_, k) => at.countdown + k)
      .map((t0) => `0.45*sin(2*PI*${k2(t0)}*t)*exp(-55*(t-${t0}))*between(t\\,${t0}\\,${t0 + 0.15})`).join("+");
    const r = at.reveal;
    const chime = `0.32*(sin(2*PI*880*t)+0.6*sin(2*PI*1318.5*t)+0.3*sin(2*PI*1760*t))*exp(-3.2*(t-${r}))*gte(t\\,${r})`;
    const pad = `0.022*(sin(2*PI*220*t)+sin(2*PI*277.18*t)+sin(2*PI*329.63*t))*(0.65+0.35*sin(2*PI*0.2*t))`;
    const audio = `aevalsrc='${ticks}+${chime}+${pad}':s=44100:d=${DURATION}`;

    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "concat", "-safe", "0", "-i", listFile,
      "-f", "lavfi", "-i", audio,
      "-vf", `fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "aac", "-b:a", "128k", "-t", String(DURATION), "-movflags", "+faststart", outFile,
    ]);
    return outFile;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
// Alternate tick / tock pitch.
function k2(t0) { return Math.round(t0) % 2 ? 900 : 1200; }
