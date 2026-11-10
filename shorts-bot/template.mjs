// HTML for one Short. The page exposes window.renderAt(t) which draws the exact
// frame for second t, so frames are captured deterministically (no CSS timers).
// 1080x1920; keeps text clear of the bottom ~380px and right ~140px where the
// YouTube Shorts buttons and caption sit.

export const TIMELINE = { read: 6, countdown: 5, reveal: 3, explain: 7, cta: 2.5 };
export const DURATION = Object.values(TIMELINE).reduce((a, b) => a + b, 0); // 23.5 s
const T = (() => {
  let t = 0;
  const at = {};
  for (const [k, v] of Object.entries(TIMELINE)) { at[k] = t; t += v; }
  return at;
})();

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LETTERS = ["A", "B", "C", "D"];

export function pageHtml(q) {
  const badge = q.pyqYear ? `NEET ${q.pyqYear} PYQ` : "NEET Practice";
  const explanation = String(q.explanation || "").replace(/\s+/g, " ").trim();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@500;600;700&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; }
  body { font-family: Inter, "Noto Sans", "DejaVu Sans", sans-serif; color: #14213D;
    background: linear-gradient(160deg, #14213D 0%, #1F3059 55%, #12A594 130%); }
  .wrap { position: absolute; inset: 0; padding: 110px 140px 400px 70px; display: flex; flex-direction: column; justify-content: safe center; }
  .top { display: flex; align-items: center; justify-content: space-between; color: #FBFAF7; }
  .brand { font-family: "Space Grotesk", Inter, sans-serif; font-weight: 700; font-size: 64px; letter-spacing: -1px; }
  .brand b { color: #F2A93B; }
  .badge { background: #F2A93B; color: #14213D; font-weight: 700; font-size: 40px; padding: 14px 30px; border-radius: 999px; }
  .meta { color: #FCE3B6; font-size: 38px; font-weight: 600; margin-top: 36px; line-height: 1.25; }
  .card { background: #FBFAF7; border-radius: 44px; padding: 54px 50px; margin-top: 30px; box-shadow: 0 30px 60px rgba(0,0,0,.25); }
  .q { font-family: "Space Grotesk", Inter, sans-serif; font-weight: 700; line-height: 1.22; white-space: pre-line; overflow-wrap: anywhere; hyphens: auto; }
  .opts { margin-top: 36px; display: flex; flex-direction: column; gap: 22px; }
  .opt { overflow-wrap: anywhere; display: flex; gap: 26px; align-items: center; border: 5px solid #E3E6EE; border-radius: 30px; padding: 24px 30px; font-size: 48px; font-weight: 600; transition: none; }
  .opt .l { flex: 0 0 76px; height: 76px; border-radius: 50%; background: #EEF1F7; display: grid; place-items: center; font-weight: 700; }
  .opt.right { border-color: #12A594; background: #D6F3EF; }
  .opt.right .l { background: #12A594; color: #fff; }
  .opt.dim { opacity: .35; }
  .timer { margin-top: 44px; display: flex; align-items: center; gap: 30px; color: #FBFAF7; font-size: 50px; font-weight: 700; }
  .ring { width: 150px; height: 150px; flex: 0 0 150px; }
  .bar { flex: 1; height: 18px; background: rgba(255,255,255,.18); border-radius: 999px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: #F2A93B; border-radius: 999px; }
  .ex { margin-top: 32px; background: #14213D; color: #FBFAF7; border-radius: 34px; padding: 40px 44px; line-height: 1.38; }
  .ex h3 { color: #F2A93B; font-size: 42px; margin-bottom: 14px; }
  .cta { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 120px 300px; color: #FBFAF7; background: linear-gradient(160deg, #14213D 0%, #1F3059 60%, #12A594 140%); }
  .cta .big { font-family: "Space Grotesk", Inter, sans-serif; font-size: 120px; font-weight: 700; letter-spacing: -2px; }
  .cta .big b { color: #F2A93B; }
  .cta p { font-size: 52px; font-weight: 600; margin-top: 30px; line-height: 1.3; }
  .cta .pill { margin-top: 50px; background: #F2A93B; color: #14213D; font-size: 44px; font-weight: 700; padding: 22px 44px; border-radius: 999px; }
  .hide { display: none !important; }
</style></head><body>
<div class="wrap" id="main">
  <div class="top"><div class="brand">Y<b>Neet</b></div><div class="badge">${esc(badge)}</div></div>
  <div class="meta">${esc(q.subject)} · ${esc(q.chapter)}</div>
  <div class="card">
    <div class="q" id="q">${esc(q.question)}</div>
    <div class="opts">${q.options.map((o, i) => `<div class="opt" id="o${i}"><span class="l">${LETTERS[i]}</span><span>${esc(o)}</span></div>`).join("")}</div>
  </div>
  <div class="timer" id="timer">
    <svg class="ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,.2)" stroke-width="12" fill="none"/>
      <circle id="arc" cx="60" cy="60" r="52" stroke="#F2A93B" stroke-width="12" fill="none" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="326.7" stroke-dashoffset="0"/>
      <text id="num" x="60" y="76" text-anchor="middle" font-size="48" font-weight="700" fill="#FBFAF7" font-family="Inter, sans-serif"></text></svg>
    <div id="tlabel">Think fast! Answer in 5…</div>
  </div>
  <div class="ex hide" id="ex"><h3>Answer: (${LETTERS[q.answer - 1]}) · Why?</h3><div id="exText">${esc(explanation)}</div></div>
</div>
<div class="cta hide" id="cta">
  <div class="big">Y<b>Neet</b>.in</div>
  <p>Full solution + 5,000 free NEET PYQs<br>chapter-wise, no login</p>
  <div class="pill">Follow for 3 NEET questions daily</div>
</div>
<script>
  const T = ${JSON.stringify(T)}, D = ${JSON.stringify(TIMELINE)}, ANSWER = ${q.answer - 1};
  const $ = (id) => document.getElementById(id);
  // Shrink a box's font until it fits its height budget.
  function fit(el, max, min, maxH) { let s = max; el.style.fontSize = s + "px"; while (el.scrollHeight > maxH && s > min) { s -= 2; el.style.fontSize = s + "px"; } }
  // Shrink question + options together until the whole question screen fits
  // the safe area, then size the explanation for its own screen.
  const main = () => $("main");
  const overflows = () => main().scrollHeight > main().clientHeight + 1;
  window.layout = () => {
    let q = 74, o = 48;
    const apply = () => { $("q").style.fontSize = q + "px"; for (let i = 0; i < 4; i++) $("o" + i).style.fontSize = o + "px"; };
    apply();
    while (overflows() && q > 40) { q -= 3; o = Math.max(32, o - 1.5); apply(); }
    window.renderAt(${T.explain + 0.01});
    let e = 46; $("exText").style.fontSize = e + "px";
    while (overflows() && e > 28) { e -= 2; $("exText").style.fontSize = e + "px"; }
    while (overflows() && q > 36) { q -= 3; $("q").style.fontSize = q + "px"; }
  };
  window.renderAt = (t) => {
    const inCount = t >= T.countdown && t < T.reveal;
    const revealed = t >= T.reveal;
    const left = Math.max(0, T.reveal - t);
    $("timer").classList.toggle("hide", revealed);
    $("num").textContent = t < T.countdown ? "5" : String(Math.ceil(left));
    $("arc").setAttribute("stroke-dashoffset", String(326.7 * (inCount ? 1 - left / D.countdown : 0)));
    $("tlabel").textContent = t < T.countdown ? "Read carefully… timer starts soon" : "Think fast! Answer in " + Math.ceil(left) + "…";
    for (let i = 0; i < 4; i++) {
      $("o" + i).classList.toggle("right", revealed && i === ANSWER);
      $("o" + i).classList.toggle("dim", revealed && i !== ANSWER);
      $("o" + i).classList.toggle("hide", t >= T.explain && i !== ANSWER); // room for the explanation
    }
    $("ex").classList.toggle("hide", t < T.explain || t >= T.cta);
    $("cta").classList.toggle("hide", t < T.cta);
  };
</script></body></html>`;
}
