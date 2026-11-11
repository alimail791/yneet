// HTML for the NEET PYQ books (one subject) and chapter booklets (one chapter).
// Printed to A4 PDF by build.mjs with headless Chrome. Layout per chapter:
// header with weightage → questions (attempt first) → answer key → solutions.

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const L = ["A", "B", "C", "D"];
const yearRange = (chs) => {
  const ys = chs.flatMap((c) => c.questions.map((q) => q.year));
  return ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : "";
};

const CSS = `
  @page { size: A4; margin: 16mm 15mm 18mm; }
  @page :first { margin: 0; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif; font-size: 10.6pt; line-height: 1.45; color: #14213D; margin: 0; }
  h1, h2, h3 { font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif; margin: 0; }
  .cover { height: 297mm; width: 210mm; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(160deg, #14213D 0%, #1F3059 60%, #12A594 140%); color: #FBFAF7; padding: 26mm 20mm 22mm; page-break-after: always; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cover .brand { font-size: 30pt; font-weight: 800; letter-spacing: -0.5pt; }
  .cover .brand b { color: #F2A93B; }
  .cover .kicker { color: #F2A93B; font-weight: 700; letter-spacing: 2pt; text-transform: uppercase; font-size: 11pt; }
  .cover h1 { font-size: 34pt; line-height: 1.12; margin-top: 6mm; }
  .cover .sub { font-size: 14pt; margin-top: 6mm; color: #FCE3B6; }
  .cover .facts { display: flex; gap: 6mm; margin-top: 12mm; flex-wrap: wrap; }
  .cover .fact { background: rgba(255,255,255,.12); border-radius: 4mm; padding: 4mm 5mm; }
  .cover .fact b { display: block; font-size: 20pt; color: #F2A93B; }
  .cover .inst { display: flex; align-items: center; gap: 5mm; background: #FBFAF7; color: #14213D; border-radius: 4mm; padding: 5mm 6mm; }
  .cover .inst img { max-height: 18mm; max-width: 40mm; object-fit: contain; }
  .cover .inst small { display: block; color: #555; font-size: 9pt; }
  .cover .inst strong { font-size: 15pt; }
  .cover .foot { font-size: 10pt; color: #FBFAF7; opacity: .85; }
  .front { page-break-after: always; }
  .front h2 { font-size: 16pt; margin: 2mm 0 4mm; }
  .front p { margin: 0 0 3mm; }
  .front .note { font-size: 9pt; color: #555; border-top: 1px solid #ddd; padding-top: 3mm; margin-top: 8mm; }
  table.toc { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.toc td, table.toc th { padding: 1.6mm 2mm; border-bottom: 1px solid #E3E6EE; text-align: left; }
  table.toc th { background: #F4F5F8; }
  .pri-High { color: #0B7F72; font-weight: 700; } .pri-Low { color: #888; }
  .chapter { page-break-before: always; }
  .chhead { border-left: 2.2mm solid #F2A93B; padding: 1mm 0 1mm 4mm; margin-bottom: 4mm; }
  .chhead .sub { font-size: 9pt; text-transform: uppercase; letter-spacing: 1pt; color: #0B7F72; font-weight: 700; }
  .chhead h2 { font-size: 18pt; line-height: 1.2; }
  .wbox { display: flex; gap: 3mm; margin: 0 0 5mm; flex-wrap: wrap; }
  .wbox div { background: #FFF4E0; border-radius: 2mm; padding: 2mm 3.5mm; font-size: 9pt; }
  .wbox b { font-size: 11pt; }
  .q { break-inside: avoid; margin: 0 0 4.2mm; }
  .q .stem { white-space: pre-line; }
  .q .n { font-weight: 700; margin-right: 1.5mm; }
  .q .yr { display: inline-block; font-size: 7.6pt; font-weight: 700; background: #14213D; color: #fff; border-radius: 1mm; padding: 0.2mm 1.4mm; margin-left: 1.5mm; vertical-align: 1px; }
  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8mm 6mm; margin: 1.5mm 0 0 5mm; }
  .opts.long { grid-template-columns: 1fr; }
  .opts span b { margin-right: 1.2mm; }
  .key { break-inside: avoid; margin: 7mm 0 5mm; border: 1px solid #E3E6EE; border-radius: 2mm; }
  .key h3 { background: #14213D; color: #fff; font-size: 10.5pt; padding: 2mm 3.5mm; border-radius: 2mm 2mm 0 0; }
  .key .grid { display: grid; grid-template-columns: repeat(10, 1fr); font-size: 9pt; }
  .key .grid span { padding: 1.3mm 0; text-align: center; border-bottom: 1px solid #F0F1F4; border-right: 1px solid #F0F1F4; }
  .sol h3 { font-size: 12pt; margin: 5mm 0 3mm; color: #0B7F72; }
  .s { break-inside: avoid; margin: 0 0 3mm; font-size: 9.8pt; }
  .s b.a { color: #0B7F72; }
  .s .ex { white-space: pre-line; color: #333; }
  .cta { break-inside: avoid; margin-top: 6mm; background: #F4F5F8; border-radius: 2mm; padding: 3.5mm 4mm; font-size: 9.5pt; }
  .cta b { color: #0B7F72; }
`;

function cover({ title, subtitle, kicker, facts, institute }) {
  return `<section class="cover">
    <div>
      <div class="brand">Y<b>Neet</b></div>
      <div class="kicker" style="margin-top:22mm">${esc(kicker)}</div>
      <h1>${esc(title)}</h1>
      <div class="sub">${esc(subtitle)}</div>
      <div class="facts">${facts.map(([v, l]) => `<div class="fact"><b>${esc(v)}</b>${esc(l)}</div>`).join("")}</div>
    </div>
    <div>
      ${institute?.name ? `<div class="inst">${institute.logo ? `<img src="${esc(institute.logo)}" alt="">` : ""}<div><small>Presented by</small><strong>${esc(institute.name)}</strong></div></div>` : ""}
      <div class="foot" style="margin-top:6mm">Free timed tests, NEET mocks and 5,000+ PYQs at www.yneet.in</div>
    </div>
  </section>`;
}

function chapterHtml(c, startNo = 1) {
  const w = c.weightage;
  const qs = c.questions;
  const longOpts = (q) => q.options.some((o) => String(o).length > 38);
  const questions = qs.map((q, i) => `<div class="q">
      <div class="stem"><span class="n">${startNo + i}.</span>${esc(q.question)}<span class="yr">NEET ${q.year}</span></div>
      <div class="opts${longOpts(q) ? " long" : ""}">${q.options.map((o, k) => `<span><b>(${L[k]})</b>${esc(o)}</span>`).join("")}</div>
    </div>`).join("");
  const key = qs.map((q, i) => `<span>${startNo + i}. <b>${L[q.answer - 1]}</b></span>`).join("");
  const sols = qs.map((q, i) => `<div class="s"><b>${startNo + i}.</b> <b class="a">(${L[q.answer - 1]}) ${esc(q.options[q.answer - 1])}</b>${q.explanation ? `<div class="ex">${esc(q.explanation)}</div>` : ""}</div>`).join("");
  return `<section class="chapter">
    <div class="chhead"><div class="sub">${esc(c.subject)}${c.classLevel ? ` · Class ${esc(c.classLevel.replace(/th/g, ""))}` : ""}</div><h2>${esc(c.chapter)}</h2></div>
    <div class="wbox">
      <div><b>${qs.length}</b> NEET PYQs (${esc(yearRange([c]))})</div>
      ${w ? `<div>Weightage: <b>~${w.expectedQs}</b> Qs · <b>~${w.marks}</b> marks per paper</div><div>Priority: <b class="pri-${w.priority}">${w.priority}</b> (#${w.rank} in ${esc(c.subject)})</div>` : ""}
    </div>
    ${questions}
    <div class="key"><h3>Answer key — ${esc(c.chapter)}</h3><div class="grid">${key}</div></div>
    <div class="sol"><h3>Solutions</h3>${sols}</div>
    <div class="cta">Practise <b>${esc(c.chapter)}</b> as a timed chapter test with instant analysis: <b>www.yneet.in/neet-practice/${esc(c.slug)}</b></div>
  </section>`;
}

const wrap = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;

// Full subject book.
export function bookHtml(subject, chapters, { institute, edition } = {}) {
  const total = chapters.reduce((a, c) => a + c.questions.length, 0);
  const title = `NEET ${subject} Chapter-wise PYQs`;
  const toc = chapters.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.chapter)}</td><td>${esc((c.classLevel || "").replace(/th/g, ""))}</td><td>${c.questions.length}</td><td>${c.weightage ? `~${c.weightage.expectedQs}` : "—"}</td><td class="pri-${c.weightage?.priority || ""}">${c.weightage?.priority || "—"}</td></tr>`).join("");
  const front = `<section class="front">
    <h2>How to use this book</h2>
    <p>Every chapter has the NEET previous year questions (PYQs) from ${esc(yearRange(chapters))}, newest first. Attempt them like a test first, then check the answer key and read the solutions at the end of the chapter.</p>
    <p>Start with the <b>High</b> priority chapters: they carry the most marks in a NEET paper. Weightage shows the average number of questions a chapter gets per paper.</p>
    <h2 style="margin-top:7mm">Contents</h2>
    <table class="toc"><tr><th>#</th><th>Chapter</th><th>Class</th><th>PYQs</th><th>Qs/paper</th><th>Priority</th></tr>${toc}</table>
    <p class="note">Questions are from NEET (UG) papers conducted by the National Testing Agency, reproduced for practice. Answers and solutions © ${new Date().getFullYear()} YNeet / Raise Academy. ${esc(edition || "")} Not affiliated with NTA. Questions that need a figure are not included.</p>
  </section>`;
  let n = 1;
  const body = chapters.map((c) => { const h = chapterHtml(c, n); n += c.questions.length; return h; }).join("");
  return wrap(title, cover({
    kicker: `NEET ${yearRange(chapters)} · with detailed solutions`, title, subtitle: `${chapters.length} chapters in NCERT order, weightage and priority for each`,
    facts: [[total.toLocaleString("en-IN"), " questions"], [String(chapters.length), " chapters"], [yearRange(chapters), " papers"]], institute,
  }) + front + body);
}

// One-chapter booklet (free download).
export function bookletHtml(c, { institute } = {}) {
  const title = `${c.chapter} — NEET PYQs`;
  return wrap(title, cover({
    kicker: `NEET ${c.subject} · ${yearRange([c])}`, title: `${c.chapter}`, subtitle: "NEET previous year questions with answers and detailed solutions",
    facts: [[String(c.questions.length), " PYQs"], ...(c.weightage ? [[`~${c.weightage.expectedQs}`, " Qs per paper"], [c.weightage.priority, " priority"]] : [])], institute,
  }) + chapterHtml(c).replace('class="chapter"', 'class="chapter" style="page-break-before:auto"'));
}
