// Public, no-login chapter practice pages for www.yneet.in (SEO).
// Each NEET chapter gets up to FREE_PER_CHAPTER questions — previous-year (PYQ)
// questions first, newest year first — with answers and explanations, so Google
// can index real content. The full chapter (timed test, score, weak topics)
// stays inside YNeet behind the free 30-day trial.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const FREE_PER_CHAPTER = 10;
const MIN_QUESTIONS = 5; // skip chapters too thin to make a useful page
const NEET_CLASSES = ["11th", "12th", "Dropper"]; // foundation (6th–10th) excluded
const SUBJECT_ORDER = ["Physics", "Chemistry", "Biology"];
const CACHE_MS = 6 * 60 * 60 * 1000;

const slugify = (s) =>
  String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

// The bank spells some chapters several ways ("Cell: The Unit of Life" /
// "Cell — The Unit of Life", "d and f Block Elements" / "The d- and f-Block
// Elements") and has a few broad buckets ("Genetics", "Periodic Table"). Each
// page must be one NCERT chapter, so variants merge into a single page.
const keyOf = (s) =>
  String(s).toLowerCase().replace(/&/g, " and ").replace(/[—–:\-]/g, " ").replace(/\(.*?\)/g, " ")
    .replace(/^the\s+/, "").replace(/\s+/g, " ").trim();
const CANON = {
  Physics: {
    "kinetic theory of gases": "Kinetic Theory",
    "magnetism": "Magnetism and Matter",
    "ray optics": "Ray Optics and Optical Instruments",
    "rotational motion": "System of Particles and Rotational Motion",
    "nuclear physics": "Nuclei",
    "physical world and measurement": "Units and Measurements",
  },
  Chemistry: {
    "chemical bonding": "Chemical Bonding and Molecular Structure",
    "classification of elements and periodicity": "Classification of Elements and Periodicity in Properties",
    "periodic table": "Classification of Elements and Periodicity in Properties",
    "d and f block elements": "The d- and f-Block Elements",
    "p block elements": "The p-Block Elements",
    "organic chemistry": "Organic Chemistry: Some Basic Principles and Techniques",
    "organic chemistry basics": "Organic Chemistry: Some Basic Principles and Techniques",
    "organic chemistry basic principles": "Organic Chemistry: Some Basic Principles and Techniques",
    "organic chemistry some basic principles and techniques": "Organic Chemistry: Some Basic Principles and Techniques",
    "solid state": "The Solid State",
    "s block elements": "The s-Block Elements",
  },
  Biology: {
    "biotechnology principles and processes": "Biotechnology: Principles and Processes",
    "biotechnology and its applications": "Biotechnology and its Applications",
    "cell the unit of life": "Cell: The Unit of Life",
    "excretory products and their elimination": "Excretory Products and their Elimination",
    "genetics": "Principles of Inheritance and Variation",
  },
};
// Too broad to be one chapter page; their questions stay inside YNeet.
const SKIP = { Physics: ["mechanics"], Biology: ["plant physiology"] };
const canonical = (subject, chapter) => {
  const k = keyOf(chapter);
  if ((SKIP[subject] || []).includes(k)) return null;
  return { key: keyOf(CANON[subject]?.[k] || chapter), name: CANON[subject]?.[k] || null };
};

let cache = null;

async function build() {
  const rows = await prisma.question.findMany({
    where: { classLevel: { in: NEET_CLASSES }, subject: { in: SUBJECT_ORDER } },
    select: {
      id: true, subject: true, chapter: true, topic: true, questionText: true,
      optionA: true, optionB: true, optionC: true, optionD: true, correctOpt: true,
      explanation: true, isPYQ: true, pyqYear: true, classLevel: true,
    },
  });

  // Group by subject + chapter; the same question can exist for several class
  // levels, so de-duplicate on the question text.
  const groups = new Map();
  for (const q of rows) {
    if (!q.chapter || !q.questionText) continue;
    const canon = canonical(q.subject, q.chapter.trim());
    if (!canon) continue;
    const key = `${q.subject}|${canon.key}`;
    if (!groups.has(key)) groups.set(key, { subject: q.subject, chapter: canon.name, names: new Map(), seen: new Set(), qs: [], classes: new Set() });
    const g = groups.get(key);
    if (!canon.name) g.names.set(q.chapter.trim(), (g.names.get(q.chapter.trim()) || 0) + 1);
    g.classes.add(q.classLevel);
    const k = norm(q.questionText);
    if (g.seen.has(k)) continue;
    g.seen.add(k);
    g.qs.push(q);
  }

  const chapters = [];
  const usedSlugs = new Set();
  for (const g of groups.values()) {
    if (g.qs.length < MIN_QUESTIONS) continue;
    // Display name: the official one if mapped, else the most-used spelling.
    if (!g.chapter) g.chapter = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const pyqs = g.qs.filter((q) => q.isPYQ);
    // Stable order so pages don't change on every build: PYQs newest year first, then id.
    const order = (a, b) => (b.isPYQ - a.isPYQ) || ((b.pyqYear || 0) - (a.pyqYear || 0)) || (a.id < b.id ? -1 : 1);
    const free = [...g.qs].sort(order).slice(0, FREE_PER_CHAPTER).map((q) => ({
      id: q.id, topic: q.topic, question: q.questionText,
      // correctOpt is 0-based in the bank (A = 0); the website expects 1-based.
      options: [q.optionA, q.optionB, q.optionC, q.optionD], answer: q.correctOpt + 1,
      explanation: q.explanation, pyqYear: q.isPYQ ? q.pyqYear || null : null,
    }));
    let slug = `${slugify(g.subject)}/${slugify(g.chapter)}`;
    while (usedSlugs.has(slug)) slug += "-2";
    usedSlugs.add(slug);
    const years = [...new Set(pyqs.map((q) => q.pyqYear).filter(Boolean))].sort((a, b) => a - b);
    chapters.push({
      slug, subject: g.subject, chapter: g.chapter, total: g.qs.length, pyqCount: pyqs.length,
      pyqYears: years.length ? [years[0], years[years.length - 1]] : null,
      classes: NEET_CLASSES.filter((c) => g.classes.has(c)),
      topics: [...new Set(g.qs.map((q) => q.topic).filter(Boolean))].slice(0, 12),
      questions: free,
    });
  }
  chapters.sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || a.chapter.localeCompare(b.chapter));
  return { at: Date.now(), chapters };
}

async function data() {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = await build();
  return cache;
}

// GET /api/v1/public/practice            → chapter list (no questions)
// GET /api/v1/public/practice?full=1     → every chapter with its free questions (used at website build time)
exports.listChapters = async (req, res) => {
  try {
    const { chapters } = await data();
    res.set("Cache-Control", "public, max-age=3600");
    if (req.query.full === "1") return res.json({ success: true, freePerChapter: FREE_PER_CHAPTER, chapters });
    res.json({ success: true, freePerChapter: FREE_PER_CHAPTER, chapters: chapters.map(({ questions, ...c }) => c) });
  } catch (err) {
    console.error("practice list error:", err);
    res.status(500).json({ success: false, message: "Could not load chapters" });
  }
};

// GET /api/v1/public/practice/:subject/:chapter
exports.getChapter = async (req, res) => {
  try {
    const { chapters } = await data();
    const slug = `${req.params.subject}/${req.params.chapter}`.toLowerCase();
    const c = chapters.find((x) => x.slug === slug);
    if (!c) return res.status(404).json({ success: false, message: "Chapter not found" });
    res.set("Cache-Control", "public, max-age=3600");
    res.json({ success: true, chapter: c });
  } catch (err) {
    console.error("practice chapter error:", err);
    res.status(500).json({ success: false, message: "Could not load chapter" });
  }
};

// GET /api/v1/public/readiness — the free "NEET Readiness Score" quiz on
// www.yneet.in/neet-readiness. 15 questions in NEET's subject weighting
// (Biology is half the paper), each from a different chapter so the result
// can name weak chapters and link to their free practice pages. Answers are
// included: it's a no-login marketing quiz, scored in the browser.
const READINESS_MIX = { Physics: 4, Chemistry: 4, Biology: 7 };
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

exports.readinessQuiz = async (req, res) => {
  try {
    const { chapters } = await data();
    const questions = [];
    for (const [subject, n] of Object.entries(READINESS_MIX)) {
      for (const c of shuffle(chapters.filter((x) => x.subject === subject)).slice(0, n)) {
        const q = shuffle(c.questions)[0];
        if (!q) continue;
        questions.push({
          id: q.id, subject, chapter: c.chapter, slug: c.slug, question: q.question,
          options: q.options, answer: q.answer, explanation: q.explanation, pyqYear: q.pyqYear,
        });
      }
    }
    res.set("Cache-Control", "no-store");
    res.json({ success: true, questions });
  } catch (err) {
    console.error("readiness quiz error:", err);
    res.status(500).json({ success: false, message: "Could not load the quiz" });
  }
};

exports._internal = { build, slugify, keyOf, canonical };
exports.practiceData = data;
