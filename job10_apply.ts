// YNeet: rebuild Class 10 mock tests from the updated question bank (more tests).
// MODE dry = report only; apply = one transaction. Old tests switched off, not deleted.
const postgres = (globalThis as any).__postgres;
const MODE = "apply";
const P = "Physics", C = "Chemistry", B = "Biology";
const raw = Bun.env.DIRECT_URL || Bun.env.DATABASE_URL;
if (!raw) { console.log("TENJOB: no db url"); process.exit(0); }
const u = new URL(raw);
for (const k of ["pgbouncer", "connection_limit", "schema", "pool_timeout"]) u.searchParams.delete(k);
const sql = postgres(u.toString(), { ssl: "require", prepare: false, max: 1 });
const log = (...a) => console.log("TENJOB", ...a);
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const pad = (n, w = 2) => String(n).padStart(w, "0");
const textKey = (q) => String(q.t + "|" + q.a + "|" + q.b).toLowerCase().replace(/[^a-z0-9]/g, "");

// Fair rotating picker: each test gets chapters in proportion to their size
// (carry-over credits, so small chapters still get their share over the batch),
// and inside a chapter questions are handed out in a shuffled cycle, so every
// question is reused the same number of times (±1) across the whole batch.
function makePicker(pool) {
  const byCh = {};
  for (const q of pool) (byCh[q.chapter] = byCh[q.chapter] || []).push(q);
  const chs = Object.keys(byCh);
  const st = {};
  for (const c of chs) st[c] = { seq: shuffle(byCh[c]), cur: 0, credit: Math.random() * 0.5 };
  const total = pool.length;
  return {
    size: total, chapters: chs.length,
    take(n) {
      if (!total) return [];
      n = Math.min(n, total);
      const alloc = {};
      let sum = 0;
      for (const c of chs) { st[c].credit += (n * byCh[c].length) / total; alloc[c] = Math.max(0, Math.min(Math.floor(st[c].credit), byCh[c].length)); sum += alloc[c]; }
      const rem = (c) => st[c].credit - alloc[c];
      while (sum < n) {
        let best = null;
        for (const c of chs) if (alloc[c] < byCh[c].length && (best === null || rem(c) > rem(best) || (rem(c) === rem(best) && Math.random() < 0.5))) best = c;
        if (best === null) break;
        alloc[best]++; sum++;
      }
      while (sum > n) {
        let worst = null;
        for (const c of chs) if (alloc[c] > 0 && (worst === null || rem(c) < rem(worst))) worst = c;
        alloc[worst]--; sum--;
      }
      const out = [];
      for (const c of chs) {
        st[c].credit -= alloc[c];
        const s = st[c]; const used = new Set();
        let k = 0;
        while (k < alloc[c]) {
          if (s.cur >= s.seq.length) { s.seq = shuffle(byCh[c]); s.cur = 0; }
          const q = s.seq[s.cur++];
          if (used.has(q.id)) continue;
          used.add(q.id); out.push(q); k++;
        }
      }
      return out;
    },
  };
}


try {
  const all = await sql`select id, subject, "classLevel", chapter, explanation, left("questionText", 300) t, "optionA" a, "optionB" b from questions where "classLevel" = '10th' and subject in ('Physics','Chemistry','Biology')`;
  const pool = (s) => { const m = new Map(); for (const q of all) if (q.subject === s) { const k = textKey(q); if (!m.has(k)) m.set(k, q); } return [...m.values()]; };
  const pools = { [P]: pool(P), [C]: pool(C), [B]: pool(B) };
  const pk = { [P]: makePicker(pools[P]), [C]: makePicker(pools[C]), [B]: makePicker(pools[B]) };
  const slots = { [P]: 0, [C]: 0, [B]: 0 };
  const take = (s, n) => { slots[s] += n; return pk[s].take(n); };
  const newTests = []; let order = 0;
  const T = (title, type, subject, durationMin, qs) => {
    const ids = [...new Set(qs.map((q) => q.id))];
    if (ids.length !== qs.length) throw new Error("duplicate question inside " + title);
    newTests.push({ title, type, subject, durationMin, ids, order: order++ });
  };
  for (let i = 1; i <= 20; i++) T(`10th Full Test ${pad(i)}`, "full", null, 75, [...take(P, 20), ...take(C, 20), ...take(B, 20)]);
  for (const s of [P, C, B]) for (let i = 1; i <= 12; i++) T(`10th ${s} Test ${pad(i)}`, "subject", s, 30, take(s, 20));
  // CBSE board PYQ series (each board question used once, ~20 per test)
  const board = {};
  for (const s of [P, C, B]) {
    const qs = pools[s].filter((q) => String(q.id).startsWith("pyq") && /\(CBSE Class 10 Science /.test(q.explanation || ""));
    const byCh = {}; for (const q of qs) (byCh[q.chapter] = byCh[q.chapter] || []).push(q);
    const lists = shuffle(Object.values(byCh)).map(shuffle);
    const seq = []; let r = 0, left = qs.length;
    while (left > 0) { for (const l of lists) if (l.length > r) { seq.push(l[r]); left--; } r++; }
    const nT = Math.max(1, Math.floor(qs.length / 20));
    const buckets = Array.from({ length: nT }, () => []);
    seq.forEach((q, i) => buckets[i % nT].push(q));
    buckets.forEach((b, i) => T(`10th CBSE Board PYQ — ${s} ${pad(i + 1)}`, "subject", s, Math.round(b.length * 1.5), b));
    board[s] = { questions: qs.length, tests: nT, sizes: [...new Set(buckets.map((b) => b.length))] };
  }
  for (let i = 1; i <= 60; i++) T(`10th Daily Practice ${pad(i, 3)}`, "daily", null, 15, [...take(P, 5), ...take(C, 5), ...take(B, 5)]);
  // chapter tests: 2 x 20 per chapter (min 10 questions)
  const chap = { made: 0, skipped: [] };
  for (const s of [P, C, B]) {
    const byCh = {}; for (const q of pools[s]) (byCh[q.chapter] = byCh[q.chapter] || []).push(q);
    for (const [ch, list] of Object.entries(byCh).sort()) {
      const p = shuffle(list);
      if (p.length < 10) { chap.skipped.push(`${s} ${ch} (${p.length})`); continue; }
      for (let n = 1; n <= 2; n++) {
        let picked = p.slice((n - 1) * 20, n * 20);
        if (picked.length < 20) { const have = new Set(picked.map((q) => q.id)); picked = [...picked, ...shuffle(p.filter((q) => !have.has(q.id))).slice(0, 20 - picked.length)]; }
        T(`${ch} — Chapter Test ${n}`, "chapter", s, 20, picked); chap.made++;
      }
    }
  }
  const stats = Object.fromEntries([P, C, B].map((s) => [s, { pool: pools[s].length, slots: slots[s], reuse: +(slots[s] / pools[s].length).toFixed(2) }]));
  log("stats", JSON.stringify(stats), "board", JSON.stringify(board), "chapter", JSON.stringify(chap));
  const summary = {}; for (const t of newTests) { const k = `${t.type}${t.subject ? "|" + t.subject : ""}${t.title.includes("Board") ? "|board" : ""}`; summary[k] = summary[k] || { tests: 0, sizes: new Set() }; summary[k].tests++; summary[k].sizes.add(t.ids.length); }
  log("new_tests", newTests.length, JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { tests: v.tests, sizes: [...v.sizes] }]))));
  const old = await sql`select id from mock_tests where "isActive" = true and "classLevel" = '10th'`;
  const oldIds = old.map((o) => o.id);
  log("old_to_switch_off", oldIds.length);
  if (MODE !== "apply") { log("DRY RUN — nothing changed"); await sql.end(); process.exit(0); }
  const base = Date.now();
  await sql.begin(async (tx) => {
    const rows = [], links = [];
    for (const t of newTests) {
      const id = "mk" + crypto.randomUUID().replace(/-/g, "").slice(0, 23);
      rows.push({ id, title: t.title, type: t.type, classLevel: "10th", subject: t.subject, totalMarks: t.ids.length * 4, totalQs: t.ids.length, durationMin: t.durationMin, isActive: true, createdAt: new Date(base + t.order * 10) });
      for (const q of t.ids) links.push({ A: id, B: q });
    }
    for (let i = 0; i < rows.length; i += 200) await tx`insert into mock_tests ${tx(rows.slice(i, i + 200))}`;
    for (let i = 0; i < links.length; i += 2000) await tx`insert into "_MockTestToQuestion" ${tx(links.slice(i, i + 2000), "A", "B")}`;
    await tx`update mock_tests set "isActive" = false where id = any(${oldIds})`;
    log("APPLIED tests", rows.length, "links", links.length, "switched_off", oldIds.length);
  });
  const v = await sql`select m.type, m.subject, count(distinct m.id)::int tests, count(l."B")::int links from mock_tests m left join "_MockTestToQuestion" l on l."A" = m.id where m."isActive" and m."classLevel" = '10th' group by 1,2 order by 1,2`;
  const bad = await sql`select count(*)::int n from mock_tests m where m."isActive" and m."classLevel" = '10th' and m."totalQs" <> (select count(*) from "_MockTestToQuestion" l where l."A" = m.id)`;
  log("VERIFY", JSON.stringify(v), "count_mismatch", bad[0].n);
} catch (e) { log("ERROR", e?.message || e); await sql.end(); process.exit(1); }
await sql.end();
process.exit(0);
