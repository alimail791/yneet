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

  // One-question pages (/neet-question/<text-slug>-<id>). Only questions good
  // enough to stand alone as a page: a real explanation, four options, no
  // images or HTML Google would see as broken. Same stable order as above.
  const byChapter = [];
  for (const c of chapters) {
    const g = groups.get(`${c.subject}|${keyOf(c.chapter)}`) || [...groups.values()].find((x) => x.chapter === c.chapter && x.subject === c.subject);
    if (!g) continue;
    const order = (a, b) => (b.isPYQ - a.isPYQ) || ((b.pyqYear || 0) - (a.pyqYear || 0)) || (a.id < b.id ? -1 : 1);
    const list = [...g.qs].filter(pageWorthy).sort(order).map((q) => questionPage(q, c));
    if (list.length) byChapter.push(list);
  }
  // Interleave chapters (round-robin) so a capped build still covers every chapter.
  const questionPages = [];
  for (let i = 0; byChapter.some((l) => i < l.length); i++) for (const l of byChapter) if (i < l.length) questionPages.push(l[i]);
  const questionById = new Map(questionPages.map((q) => [q.id, q]));
  for (const c of chapters) c.questionPageCount = byChapter.find((l) => l[0].chapterSlug === c.slug)?.length || 0;
  return { at: Date.now(), chapters, questionPages, questionById };
}

const MIN_EXPLANATION = 60;
const pageWorthy = (q) =>
  String(q.questionText).trim().length >= 25 &&
  String(q.explanation || "").trim().length >= MIN_EXPLANATION &&
  [q.optionA, q.optionB, q.optionC, q.optionD].every((o) => String(o || "").trim()) &&
  q.correctOpt >= 0 && q.correctOpt <= 3 &&
  ![q.questionText, q.optionA, q.optionB, q.optionC, q.optionD].some((t) => /<img|https?:\/\/|\[image|figure shown|diagram (?:given|shown|below)/i.test(String(t)));

// The URL carries the first words of the question (what students search for)
// plus the id, which is what the page is looked up by.
const questionSlug = (q) => {
  const words = slugify(q.questionText).split("-").filter(Boolean).slice(0, 10).join("-") || "question";
  return `${words}-${q.id}`;
};
const questionPage = (q, c) => ({
  id: q.id, slug: questionSlug(q), subject: c.subject, chapter: c.chapter, chapterSlug: c.slug,
  topic: q.topic, question: q.questionText,
  options: [q.optionA, q.optionB, q.optionC, q.optionD], answer: q.correctOpt + 1, // bank is 0-based, website 1-based
  explanation: q.explanation, pyqYear: q.isPYQ ? q.pyqYear || null : null,
});

// Same-chapter neighbours for "More questions" links on a question page.
function relatedTo(d, q, n = 8) {
  const same = d.questionPages.filter((x) => x.chapterSlug === q.chapterSlug && x.id !== q.id);
  const at = Math.max(0, d.questionPages.filter((x) => x.chapterSlug === q.chapterSlug).findIndex((x) => x.id === q.id));
  return [...same.slice(at), ...same.slice(0, at)].slice(0, n).map(({ id, slug, question, pyqYear }) => ({ id, slug, question: question.slice(0, 140), pyqYear }));
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

// GET /api/v1/public/questions?limit=3000
//   → the first <limit> one-question pages (chapters interleaved), each with
//     its related links. Used at website build time to write static pages.
// GET /api/v1/public/questions?index=1&limit=…
//   → only {slug, chapterSlug, question} per page (chapter pages' link lists).
exports.listQuestionPages = async (req, res) => {
  try {
    const d = await data();
    const limit = Math.max(0, Math.min(parseInt(req.query.limit, 10) || 3000, d.questionPages.length));
    const pages = d.questionPages.slice(0, limit);
    res.set("Cache-Control", "public, max-age=3600");
    if (req.query.index === "1") {
      return res.json({ success: true, total: d.questionPages.length, pages: pages.map(({ slug, chapterSlug, question, pyqYear }) => ({ slug, chapterSlug, question: question.slice(0, 140), pyqYear })) });
    }
    res.json({ success: true, total: d.questionPages.length, pages: pages.map((q) => ({ ...q, related: relatedTo(d, q) })) });
  } catch (err) {
    console.error("question pages list error:", err);
    res.status(500).json({ success: false, message: "Could not load questions" });
  }
};

// GET /api/v1/public/questions/:slug — one page, looked up by the id at the end
// of the slug (so an edited question keeps working under its old URL).
exports.getQuestionPage = async (req, res) => {
  try {
    const d = await data();
    const id = String(req.params.slug).split("-").pop();
    const q = d.questionById.get(id);
    if (!q) return res.status(404).json({ success: false, message: "Question not found" });
    res.set("Cache-Control", "public, max-age=3600");
    res.json({ success: true, question: { ...q, related: relatedTo(d, q) } });
  } catch (err) {
    console.error("question page error:", err);
    res.status(500).json({ success: false, message: "Could not load question" });
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
