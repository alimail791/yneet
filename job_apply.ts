// YNeet: rebuild 12th + Dropper mock tests from the updated question bank.
// MODE "dry" = compute and report only. MODE "apply" = do it in ONE transaction.
// Old tests are switched off (isActive=false), never deleted, so attempts/history stay.
const postgres = (globalThis as any).__postgres;
const MODE = "apply";
const P = "Physics", C = "Chemistry", B = "Biology";
const R = (dbSub, sub, cls, name, re) => ({ dbSub, sub, cls, name, re });

const CHAPTERS = [
  // Physics 11
  R(P, P, "11th", "Physical World and Measurement", /^(units|physical world)/),
  R(P, P, "11th", "Kinematics", /motion in a (straight|plane)|circular motion|kinematics/),
  R(P, P, "11th", "Laws of Motion", /laws of motion|^friction/),
  R(P, P, "11th", "Work, Energy and Power", /^work/),
  R(P, P, "11th", "System of Particles and Rotational Motion", /system of particles|rotational/),
  R(P, P, "11th", "Gravitation", /^gravitation/),
  R(P, P, "11th", "Mechanical Properties of Solids", /properties of solids/),
  R(P, P, "11th", "Mechanical Properties of Fluids", /properties of fluids/),
  R(P, P, "11th", "Thermal Properties of Matter", /^thermal properties/),
  R(P, P, "11th", "Thermodynamics", /^thermodynamics/),
  R(P, P, "11th", "Kinetic Theory", /^kinetic theory/),
  R(P, P, "11th", "Oscillations", /^oscillations/),
  R(P, P, "11th", "Waves", /^waves$/),
  // Physics 12
  R(P, P, "12th", "Electric Charges and Fields", /^electric charges|^electrostatics$/),
  R(P, P, "12th", "Electrostatic Potential and Capacitance", /potential and capacitance|^capacitance/),
  R(P, P, "12th", "Current Electricity", /^current electricity/),
  R(P, P, "12th", "Moving Charges and Magnetism", /^moving charges/),
  R(P, P, "12th", "Magnetism and Matter", /^magnetism( and matter)?$/),
  R(P, P, "12th", "Electromagnetic Induction", /^electromagnetic induction/),
  R(P, P, "12th", "Alternating Current", /^alternating current/),
  R(P, P, "12th", "Electromagnetic Waves", /^electromagnetic waves/),
  R(P, P, "12th", "Ray Optics and Optical Instruments", /^ray optics/),
  R(P, P, "12th", "Wave Optics", /^wave optics/),
  R(P, P, "12th", "Dual Nature of Radiation and Matter", /^dual nature/),
  R(P, P, "12th", "Atoms", /^atoms$/),
  R(P, P, "12th", "Nuclei", /^nuclei|^nuclear physics/),
  R(P, P, "12th", "Semiconductor Electronics", /^semiconductor/),
  // Chemistry 11
  R(C, C, "11th", "Some Basic Concepts of Chemistry", /some basic concepts|^mole concept/),
  R(C, C, "11th", "Structure of Atom", /^(structure of atom|atomic structure)/),
  R(C, C, "11th", "Classification of Elements and Periodicity in Properties", /^(classification of elements|periodic table)/),
  R(C, C, "11th", "Chemical Bonding and Molecular Structure", /^chemical bonding/),
  R(C, C, "11th", "States of Matter", /^states of matter/),
  R(C, C, "11th", "Thermodynamics", /^thermodynamics/),
  R(C, C, "11th", "Equilibrium", /^(chemical )?equilibrium/),
  R(C, C, "11th", "Redox Reactions", /^redox/),
  R(C, C, "11th", "Hydrogen", /^hydrogen/),
  R(C, C, "11th", "The s-Block Elements", /^(the )?s block/),
  R(C, C, "11th", "The p-Block Elements (Group 13 & 14)", /^(the )?p block elements/),
  R(C, C, "11th", "Organic Chemistry — Some Basic Principles and Techniques", /^(organic chemistry (basic|some basic)|basic organic)/),
  R(C, C, "11th", "Hydrocarbons", /^hydrocarbons/),
  // Chemistry 12
  R(C, C, "12th", "Solid State", /solid state/),
  R(C, C, "12th", "Solutions", /^solutions/),
  R(C, C, "12th", "Electrochemistry", /^electrochemistry/),
  R(C, C, "12th", "Chemical Kinetics", /^chemical kinetics/),
  R(C, C, "12th", "Surface Chemistry", /^surface chemistry/),
  R(C, C, "12th", "General Principles and Processes of Isolation of Elements", /^(general principles|metallurgy)/),
  R(C, C, "12th", "The p-Block Elements (Group 15–18)", /^(the )?p block elements/), // generic p-block resolved by class below
  R(C, C, "12th", "The d- and f-Block Elements", /^(the )?d (and|-) ?f block|^d and f block/),
  R(C, C, "12th", "Coordination Compounds", /^coordination compounds/),
  R(C, C, "12th", "Haloalkanes and Haloarenes", /^haloalkanes/),
  R(C, C, "12th", "Alcohols, Phenols and Ethers", /^(alcohols|ethers)/),
  R(C, C, "12th", "Aldehydes, Ketones and Carboxylic Acids", /^(aldehydes|carboxylic)/),
  R(C, C, "12th", "Amines", /^amines/),
  R(C, C, "12th", "Biomolecules", /^biomolecules/),
  R(C, C, "12th", "Polymers", /^polymers/),
  R(C, C, "12th", "Chemistry in Everyday Life", /^chemistry in everyday/),
  // Botany 11
  R(B, "Botany", "11th", "The Living World", /^(the )?living world/),
  R(B, "Botany", "11th", "Biological Classification", /^(biological classification|kingdom fungi|fungi kingdom)/),
  R(B, "Botany", "11th", "Plant Kingdom", /^(plant kingdom|gymnosperms)/),
  R(B, "Botany", "11th", "Morphology of Flowering Plants", /^morphology of flowering/),
  R(B, "Botany", "11th", "Anatomy of Flowering Plants", /^anatomy of flowering/),
  R(B, "Botany", "11th", "Cell — The Unit of Life", /^(cell the unit|enzymes)/),
  R(B, "Botany", "11th", "Cell Cycle and Cell Division", /^cell cycle/),
  R(B, "Botany", "11th", "Transport in Plants", /^transport in plants/),
  R(B, "Botany", "11th", "Mineral Nutrition", /^mineral nutrition/),
  R(B, "Botany", "11th", "Photosynthesis in Higher Plants", /^photosynthesis/),
  R(B, "Botany", "11th", "Respiration in Plants", /^respiration in plants/),
  R(B, "Botany", "11th", "Plant Growth and Development", /^(plant growth|photoperiodism)/),
  // Botany 12
  R(B, "Botany", "12th", "Sexual Reproduction in Flowering Plants", /^(sexual reproduction in flowering|reproduction in flowering)/),
  R(B, "Botany", "12th", "Strategies for Enhancement in Food Production", /^strategies for enhancement/),
  R(B, "Botany", "12th", "Microbes in Human Welfare", /^microbes in human/),
  R(B, "Botany", "12th", "Organisms and Populations", /^organisms and populations/),
  R(B, "Botany", "12th", "Ecosystem", /^ecosystem/),
  R(B, "Botany", "12th", "Biodiversity and Conservation", /^biodiversity/),
  R(B, "Botany", "12th", "Environmental Issues", /^environmental issues/),
  // Zoology 11
  R(B, "Zoology", "11th", "Animal Kingdom", /^(animal kingdom|insecta|vertebra)/),
  R(B, "Zoology", "11th", "Structural Organisation in Animals", /^structural organisation in animals/),
  R(B, "Zoology", "11th", "Biomolecules", /^biomolecules$/),
  R(B, "Zoology", "11th", "Digestion and Absorption", /^digestion/),
  R(B, "Zoology", "11th", "Breathing and Exchange of Gases", /^breathing/),
  R(B, "Zoology", "11th", "Body Fluids and Circulation", /^body fluids/),
  R(B, "Zoology", "11th", "Excretory Products and Their Elimination", /^excretory products/),
  R(B, "Zoology", "11th", "Locomotion and Movement", /^locomotion/),
  R(B, "Zoology", "11th", "Neural Control and Coordination", /^neural control/),
  R(B, "Zoology", "11th", "Chemical Coordination and Integration", /^chemical coordination/),
  // Zoology 12
  R(B, "Zoology", "12th", "Human Reproduction", /^human reproduction/),
  R(B, "Zoology", "12th", "Reproductive Health", /^reproductive health/),
  R(B, "Zoology", "12th", "Principles of Inheritance and Variation", /^(principles of inheritance|genetics and evolution)/),
  R(B, "Zoology", "12th", "Molecular Basis of Inheritance", /^molecular basis/),
  R(B, "Zoology", "12th", "Evolution", /^(evolution|human evolution|origin and evolution)/),
  R(B, "Zoology", "12th", "Human Health and Disease", /^human health/),
  R(B, "Zoology", "12th", "Biotechnology — Principles and Processes", /^biotechnology( principles|$)/),
  R(B, "Zoology", "12th", "Biotechnology and Its Applications", /^biotechnology and its/),
].map((c, i) => ({ ...c, key: `${c.cls}|${c.sub}|${c.name}`, order: i }));

const norm = (s) =>
  String(s || "")
    .split(" / ")[0]
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[:—–\-,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // "d- and f-block" style → "d and f block"
    .replace(/\b([a-z]) block/g, "$1 block");

// Which canonical entry does this question belong to?
function resolve(q) {
  const ch = norm(q.chapter);
  if (!ch) return null;
  const rawFull = String(q.chapter || "").toLowerCase();
  let hits = CHAPTERS.filter((c) => c.dbSub === q.subject && c.re.test(ch));
  if (!hits.length) return null;
  // Same name exists in two entries: p-Block (11 vs 12), Biomolecules is
  // split by dbSub already. Resolve p-Block by the explicit group, else class.
  if (hits.length > 1) {
    const g12 = /group 1[5-8]|nitrogen|oxygen|halogen|noble/.test(rawFull);
    const g11 = /group 1[34]|boron|carbon/.test(rawFull);
    const want = g11 ? "11th" : g12 ? "12th" : q.classLevel === "11th" ? "11th" : "12th";
    hits = hits.filter((c) => c.cls === want).concat(hits);
  }
  // "Thermodynamics" appears in Physics and Chemistry, but dbSub already splits.
  return hits[0];
}



// Clear-cut fixes for vague chapter labels (subject|chapter -> target). Mixed ones are left alone.
const MANUAL = {
  "Biology|Taxonomy": [B, "11th", "The Living World"],
  "Biology|Viruses and Viroids": [B, "11th", "Biological Classification"],
  "Biology|Amines": [C, "12th", "Amines"],
  "Biology|Body Defence Mechanism": [B, "12th", "Human Health and Disease"],
  "Biology|Biology and Human Welfare": [B, "12th", "Human Health and Disease"],
  "Biology|Cell Biology": [B, "11th", "Cell — The Unit of Life"],
  "Biology|Cell Division": [B, "11th", "Cell Cycle and Cell Division"],
  "Biology|Genetics": [B, "12th", "Principles of Inheritance and Variation"],
  "Biology|Molecular Biology": [B, "12th", "Molecular Basis of Inheritance"],
  "Chemistry|d-Block Elements": [C, "12th", "The d- and f-Block Elements"],
  "Physics|Mechanics@11th": [P, "11th", "Kinematics"],
  "Physics|Particles having mass 5kg and 10kg": [P, "11th", "System of Particles and Rotational Motion"],
  "Physics|Atomic Structure": [P, "12th", "Atoms"],
  "Physics|Structure of Atom": [P, "12th", "Atoms"],
  "Physics|SHM": [P, "11th", "Oscillations"],
  "Physics|Molecular Basis of Inheritance / Thermal Properties": [P, "11th", "Physical World and Measurement"],
};
function target(q) {
  const m = MANUAL[`${q.subject}|${q.chapter}@${q.classLevel}`] || MANUAL[`${q.subject}|${q.chapter}`];
  if (m) return { subject: m[0], cls: m[1], name: m[2] };
  const e = resolve(q);
  return e ? { subject: q.subject, cls: e.cls, name: e.name } : null;
}

const raw = Bun.env.DIRECT_URL || Bun.env.DATABASE_URL;
if (!raw) { console.log("MOCKJOB: no db url"); process.exit(0); }
const u = new URL(raw);
for (const k of ["pgbouncer", "connection_limit", "schema", "pool_timeout"]) u.searchParams.delete(k);
const sql = postgres(u.toString(), { ssl: "require", prepare: false, max: 1 });
const log = (...a) => console.log("MOCKJOB", ...a);

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
  // ── 0. sanity: join table orientation ─────────────────────────────────────
  const [lk] = await sql`select "A","B" from "_MockTestToQuestion" limit 1`;
  const [isTest] = await sql`select count(*)::int n from mock_tests where id = ${lk.A}`;
  const [isQ] = await sql`select count(*)::int n from questions where id = ${lk.B}`;
  if (isTest.n !== 1 || isQ.n !== 1) throw new Error("join table orientation unexpected");

  // ── 1. chapter clean-up plan ──────────────────────────────────────────────
  const all = await sql`select id, subject, "classLevel", chapter, "isPYQ", explanation, left("questionText", 300) t, "optionA" a, "optionB" b, difficulty from questions where "classLevel" in ('11th','12th','Dropper') and subject in ('Physics','Chemistry','Biology')`;
  const updates = [];
  for (const q of all) {
    const tg = target(q);
    if (!tg) continue;
    const cls = q.classLevel === "Dropper" ? "Dropper" : tg.cls;
    if (tg.name !== q.chapter || cls !== q.classLevel || tg.subject !== q.subject) {
      updates.push({ id: q.id, old: [q.subject, q.classLevel, q.chapter], subject: tg.subject, classLevel: cls, chapter: tg.name });
      q.subject = tg.subject; q.classLevel = cls; q.chapter = tg.name;
    }
  }
  log("chapter_updates", updates.length);

  // ── 2. pools (after clean-up), de-duplicated by question text ──────────────
  function pool(subject, classes) {
    const seen = new Map();
    for (const q of all) {
      if (q.subject !== subject || !classes.includes(q.classLevel)) continue;
      const k = textKey(q);
      const prev = seen.get(k);
      if (!prev || (prev.classLevel === "Dropper" && q.classLevel !== "Dropper")) seen.set(k, q);
    }
    return [...seen.values()];
  }
  const POOLS = { "12th": ["12th"], Dropper: ["11th", "12th", "Dropper"] };
  const SPEC = {
    "12th": { full: 12, half: 30, P: 21, C: 21, B: 41, daily: 100 },
    Dropper: { full: 32, half: 50, P: 31, C: 31, B: 62, daily: 200 },
  };
  const newTests = []; // {test, qids}
  let order = 0;
  const T = (cls, title, type, subject, durationMin, qs) => {
    const ids = [...new Set(qs.map((q) => q.id))];
    if (ids.length !== qs.length) throw new Error("duplicate question inside " + title);
    newTests.push({ cls, title, type, subject, durationMin, ids, order: order++ });
  };
  const stats = {};
  for (const cls of ["12th", "Dropper"]) {
    const sp = SPEC[cls];
    const pk = { Physics: makePicker(pool(P, POOLS[cls])), Chemistry: makePicker(pool(C, POOLS[cls])), Biology: makePicker(pool(B, POOLS[cls])) };
    const slots = { Physics: 0, Chemistry: 0, Biology: 0 };
    const take = (s, n) => { slots[s] += n; return pk[s].take(n); };
    for (let i = 1; i <= sp.full; i++) T(cls, `${cls} Full Mock Test ${pad(i)}`, "full", null, 180, [...take(P, 45), ...take(C, 45), ...take(B, 90)]);
    for (let i = 1; i <= sp.half; i++) { const odd = i % 2; T(cls, `${cls} Half Mock Test ${pad(i)}`, "half", null, 90, [...take(P, odd ? 23 : 22), ...take(C, odd ? 22 : 23), ...take(B, 45)]); }
    for (const [s, n] of [[P, sp.P], [C, sp.C], [B, sp.B]]) for (let i = 1; i <= n; i++) T(cls, `${cls} ${s} Subject Test ${pad(i)}`, "subject", s, 45, take(s, 45));
    for (let i = 1; i <= sp.daily; i++) T(cls, `${cls} Daily Practice ${pad(i, 3)}`, "daily", null, 20, [...take(P, 5), ...take(C, 5), ...take(B, 10)]);
    stats[cls] = Object.fromEntries(Object.entries(pk).map(([s, p]) => [s, { pool: p.size, chapters: p.chapters, slots: slots[s], reuse: +(slots[s] / p.size).toFixed(2) }]));
  }
  log("mock_stats", JSON.stringify(stats));

  // ── 3. 12th CBSE Board PYQ series (each board question used once) ─────────
  const board = {};
  for (const s of [P, C, B]) {
    const qs = all.filter((q) => q.subject === s && q.classLevel === "12th" && String(q.id).startsWith("pyq") && /\(CBSE Class 12 /.test(q.explanation || ""));
    const byCh = {}; for (const q of qs) (byCh[q.chapter] = byCh[q.chapter] || []).push(q);
    const lists = shuffle(Object.values(byCh)).map(shuffle);
    const seq = []; let r = 0, left = qs.length;
    while (left > 0) { for (const l of lists) if (l.length > r) { seq.push(l[r]); left--; } r++; }
    const nTests = Math.max(1, Math.floor(qs.length / 45));
    // deal round-robin so every test spans all chapters
    const buckets = Array.from({ length: nTests }, () => []);
    seq.forEach((q, i) => buckets[i % nTests].push(q));
    buckets.forEach((b, i) => T("12th", `12th CBSE Board PYQ — ${s} ${pad(i + 1)}`, "subject", s, b.length, b));
    board[s] = { questions: qs.length, tests: nTests, sizes: [...new Set(buckets.map((b) => b.length))] };
  }
  log("board_series", JSON.stringify(board));

  // ── 4. chapter tests for 12th + Dropper (2 x 20 per chapter, min 10) ───────
  const chap = { made: 0, skipped: [] };
  for (const e of CHAPTERS) {
    for (const cls of ["12th", "Dropper"]) {
      if (cls === "12th" && e.cls !== "12th") continue;
      const classes = cls === "12th" ? ["12th", "Dropper"] : ["11th", "12th", "Dropper"];
      const seen = new Map();
      for (const q of all) {
        if (q.subject !== e.dbSub || !classes.includes(q.classLevel)) continue;
        const r = resolve(q);
        if (!r || r.key !== e.key) continue;
        const k = textKey(q); const prev = seen.get(k);
        if (!prev || (prev.classLevel === "Dropper" && q.classLevel !== "Dropper")) seen.set(k, q);
      }
      const p = shuffle([...seen.values()]);
      if (p.length < 10) { chap.skipped.push(`${cls} ${e.sub} ${e.name} (${p.length})`); continue; }
      for (let n = 1; n <= 2; n++) {
        let picked = p.slice((n - 1) * 20, n * 20);
        if (picked.length < 20) { const have = new Set(picked.map((q) => q.id)); picked = [...picked, ...shuffle(p.filter((q) => !have.has(q.id))).slice(0, 20 - picked.length)]; }
        T(cls, `${e.name} — Chapter Test ${n}`, "chapter", e.sub, 20, picked);
        chap.made++;
      }
    }
  }
  log("chapter_tests", JSON.stringify(chap));

  // ── 5. what gets switched off ─────────────────────────────────────────────
  const old = await sql`select id, "classLevel", type from mock_tests where "isActive" = true and "classLevel" in ('12th','Dropper') and type in ('full','half','subject','daily','chapter')`;
  const oldIds = old.map((o) => o.id);
  const [inprog] = await sql`select count(*)::int n from attempts where status = 'in_progress' and "mockTestId" = any(${oldIds})`;
  const summary = {};
  for (const t of newTests) { const k = `${t.cls}|${t.type}${t.type === "subject" ? "|" + t.subject : ""}${t.title.includes("CBSE Board") ? "|board" : ""}`; summary[k] = summary[k] || { tests: 0, qs: new Set() }; summary[k].tests++; summary[k].qs.add(t.ids.length); }
  log("new_tests", newTests.length, JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { tests: v.tests, sizes: [...v.qs] }]))));
  const oldSum = {}; for (const o of old) { const k = `${o.classLevel}|${o.type}`; oldSum[k] = (oldSum[k] || 0) + 1; }
  log("old_tests_to_switch_off", old.length, JSON.stringify(oldSum), "in_progress_attempts_on_them", inprog.n);

  if (MODE !== "apply") { log("DRY RUN — nothing changed"); await sql.end(); process.exit(0); }

  // backup of every question row we are about to touch (old values)
  for (let i = 0; i < updates.length; i += 80) log("BACKUP", JSON.stringify(updates.slice(i, i + 80).map((x) => [x.id, ...x.old])));

  const base = Date.now();
  await sql.begin(async (tx) => {
    for (const x of updates) await tx`update questions set subject = ${x.subject}, "classLevel" = ${x.classLevel}, chapter = ${x.chapter} where id = ${x.id}`;
    const rows = [], links = [];
    for (const t of newTests) {
      const id = "mk" + crypto.randomUUID().replace(/-/g, "").slice(0, 23);
      rows.push({ id, title: t.title, type: t.type, classLevel: t.cls, subject: t.subject, totalMarks: t.ids.length * 4, totalQs: t.ids.length, durationMin: t.durationMin, isActive: true, createdAt: new Date(base + t.order * 10) });
      for (const q of t.ids) links.push({ A: id, B: q });
    }
    for (let i = 0; i < rows.length; i += 200) await tx`insert into mock_tests ${tx(rows.slice(i, i + 200))}`;
    for (let i = 0; i < links.length; i += 2000) await tx`insert into "_MockTestToQuestion" ${tx(links.slice(i, i + 2000), "A", "B")}`;
    for (let i = 0; i < oldIds.length; i += 500) await tx`update mock_tests set "isActive" = false where id = any(${oldIds.slice(i, i + 500)})`;
    log("APPLIED tests", rows.length, "links", links.length, "switched_off", oldIds.length, "questions_updated", updates.length);
  });

  // verify
  const v = await sql`select m."classLevel", m.type, count(distinct m.id)::int tests, count(l."B")::int links, sum(case when l."B" is null then 1 else 0 end)::int empty from mock_tests m left join "_MockTestToQuestion" l on l."A" = m.id where m."isActive" and m."classLevel" in ('12th','Dropper') group by 1,2 order by 1,2`;
  const bad = await sql`select count(*)::int n from mock_tests m where m."isActive" and m."classLevel" in ('12th','Dropper') and m."totalQs" <> (select count(*) from "_MockTestToQuestion" l where l."A" = m.id)`;
  log("VERIFY", JSON.stringify(v), "count_mismatch", bad[0].n);
} catch (e) {
  log("ERROR", e?.message || e);
  await sql.end(); process.exit(1);
}
await sql.end();
process.exit(0);
