// Chapter-wise tests: for every NCERT chapter of Physics, Chemistry, Botany and
// Zoology, 2 tests x 20 questions, for 11th, 12th and Dropper.
// No schema change: type="chapter", subject = Physics|Chemistry|Botany|Zoology,
// title = "<Chapter> — Chapter Test N". Questions keep subject "Biology" in the
// DB, so scoring in mockController keeps working.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TESTS_PER_CHAPTER = 2;
const QS_PER_TEST = 20;
const MIN_QS = 10; // chapters with fewer questions than this are skipped & reported

// ── Canonical chapters ──────────────────────────────────────────────────────
// [dbSubject, testSubject, class, canonical name, regex on normalised DB chapter]
const R = (dbSub, sub, cls, name, re) => ({ dbSub, sub, cls, name, re });
const P = "Physics", C = "Chemistry", B = "Biology";
const CHAPTERS = [
  // Physics 11
  R(P, P, "11th", "Units and Measurements", /^(units|physical world)/),
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

async function loadBuckets() {
  const qs = await prisma.question.findMany({
    where: { subject: { in: [P, C, B] } },
    select: { id: true, subject: true, chapter: true, classLevel: true },
  });
  const buckets = {}; // entry.key -> { entry, byClass: {11th:[],12th:[],Dropper:[]} }
  let unmapped = 0;
  for (const q of qs) {
    const e = resolve(q);
    if (!e) { unmapped++; continue; }
    const b = (buckets[e.key] = buckets[e.key] || { entry: e, all: [], c11: [], c12: [], cDr: [] });
    b.all.push(q);
    (q.classLevel === "11th" ? b.c11 : q.classLevel === "12th" ? b.c12 : b.cDr).push(q);
  }
  return { buckets, unmapped, totalQs: qs.length };
}

const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

// The plan: one row per (class, chapter) with the question pool it would use.
function buildPlan({ buckets }) {
  const plan = [];
  for (const entry of CHAPTERS) {
    const b = buckets[entry.key];
    const own = b ? (entry.cls === "11th" ? b.c11 : b.c12) : [];
    const dropperExtra = b ? b.cDr : [];
    const everything = b ? b.all : [];
    // 11th/12th: the chapter's own class (+ Dropper-labelled spillover).
    const classPool = [...own, ...dropperExtra];
    plan.push({ classLevel: entry.cls, entry, pool: classPool });
    // Dropper: every question of the chapter, from any class label.
    plan.push({ classLevel: "Dropper", entry, pool: everything });
  }
  return plan.map((p) => ({
    classLevel: p.classLevel,
    subject: p.entry.sub,
    chapter: p.entry.name,
    poolSize: p.pool.length,
    pool: p.pool,
    status: p.pool.length >= 2 * QS_PER_TEST ? "ok" : p.pool.length >= MIN_QS ? "reuse" : "skip",
  }));
}

const titleFor = (chapter, n) => `${chapter} — Chapter Test ${n}`;

// ── Preview ─────────────────────────────────────────────────────────────────
// GET /admin/mock-builder/chapter-tests/preview
exports.previewChapterTests = async (req, res) => {
  try {
    const data = await loadBuckets();
    const plan = buildPlan(data);
    const summary = {};
    for (const p of plan) {
      const k = `${p.classLevel} · ${p.subject}`;
      const s = (summary[k] = summary[k] || { chapters: 0, tests: 0, ok: 0, reuse: 0, skipped: 0 });
      s.chapters++;
      if (p.status === "skip") s.skipped++;
      else { s.tests += TESTS_PER_CHAPTER; s[p.status]++; }
    }
    const existing = await prisma.mockTest.count({ where: { type: "chapter" } });
    res.json({
      success: true,
      unmappedQuestions: data.unmapped,
      totalQuestions: data.totalQs,
      existingChapterTests: existing,
      plannedTests: plan.reduce((n, p) => n + (p.status === "skip" ? 0 : TESTS_PER_CHAPTER), 0),
      summary,
      thin: plan
        .filter((p) => p.status !== "ok")
        .map((p) => ({ classLevel: p.classLevel, subject: p.subject, chapter: p.chapter, questions: p.poolSize, status: p.status })),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Build (background job) ──────────────────────────────────────────────────
let job = null;

exports.getChapterBuildStatus = (req, res) => {
  if (!job) return res.json({ success: true, job: null });
  const { log, ...rest } = job;
  res.json({ success: true, job: { ...rest, log: log.slice(-40) } });
};

async function run() {
  const data = await loadBuckets();
  const plan = buildPlan(data);
  job.total = plan.filter((p) => p.status !== "skip").length * TESTS_PER_CHAPTER;

  for (const p of plan) {
    if (p.status === "skip") {
      job.skipped.push(`${p.classLevel} ${p.subject} · ${p.chapter} (${p.poolSize} Qs)`);
      continue;
    }
    // Test 1 and 2 use disjoint questions whenever the pool allows it.
    const shuffled = shuffle(p.pool);
    for (let n = 1; n <= TESTS_PER_CHAPTER; n++) {
      const title = titleFor(p.chapter, n);
      try {
        const exists = await prisma.mockTest.findFirst({
          where: { type: "chapter", classLevel: p.classLevel, subject: p.subject, title },
          select: { id: true },
        });
        if (exists) { job.existing++; continue; }
        let picked = shuffled.slice((n - 1) * QS_PER_TEST, n * QS_PER_TEST);
        if (picked.length < QS_PER_TEST) {
          // Not enough fresh questions for this test: top up from the rest of
          // the pool (reuse across the two tests), never repeating within one.
          const have = new Set(picked.map((q) => q.id));
          const filler = shuffle(p.pool.filter((q) => !have.has(q.id))).slice(0, QS_PER_TEST - picked.length);
          picked = [...picked, ...filler];
        }
        if (picked.length < MIN_QS) { job.skipped.push(`${p.classLevel} ${p.subject} · ${p.chapter} test ${n}`); continue; }
        await prisma.mockTest.create({
          data: {
            title,
            type: "chapter",
            classLevel: p.classLevel,
            subject: p.subject,
            totalMarks: picked.length * 4,
            totalQs: picked.length,
            durationMin: 20,
            questions: { connect: picked.map((q) => ({ id: q.id })) },
          },
        });
        job.done++;
      } catch (err) {
        job.failed++;
        job.log.push(`❌ ${p.classLevel} ${p.subject} ${title}: ${err.message}`);
      }
    }
  }
  job.running = false;
  job.finishedAt = new Date().toISOString();
}

// POST /admin/mock-builder/chapter-tests/build
exports.startChapterBuild = (req, res) => {
  if (job && job.running) return res.status(409).json({ success: false, message: "A chapter-test build is already running." });
  job = { running: true, startedAt: new Date().toISOString(), finishedAt: null, total: 0, done: 0, failed: 0, existing: 0, skipped: [], log: [] };
  res.status(202).json({ success: true, message: "Chapter-test build started." });
  run().catch((err) => { job.running = false; job.log.push(`❌ Job crashed: ${err.message}`); });
};

// ── Delete (for a clean rebuild) ────────────────────────────────────────────
// POST /admin/mock-builder/chapter-tests/delete  (only type="chapter")
exports.deleteChapterTests = async (req, res) => {
  try {
    if (job && job.running) return res.status(409).json({ success: false, message: "Build is running — wait for it to finish." });
    const tests = await prisma.mockTest.findMany({ where: { type: "chapter" }, select: { id: true } });
    const ids = tests.map((t) => t.id);
    let attemptsDeleted = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const a = await prisma.attempt.deleteMany({ where: { mockTestId: { in: chunk } } });
      attemptsDeleted += a.count;
      await prisma.mockTest.deleteMany({ where: { id: { in: chunk } } });
    }
    res.json({ success: true, deletedTests: ids.length, deletedAttempts: attemptsDeleted });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports._test = { resolve, norm, CHAPTERS };
