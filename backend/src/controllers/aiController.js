const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { anthropic, extractJson, MODEL } = require("../utils/anthropicClient");

const aiUnavailable = (res) =>
  res.status(503).json({ success: false, message: "AI Mentor isn't configured — ANTHROPIC_API_KEY is missing on the server." });

// ───────────────────────── Student: AI Mentor ─────────────────────────

// POST /api/v1/ai/explain/:questionId
// The question's own `explanation` field is static and the same for everyone —
// this gives a student who's still stuck a second, differently-worded pass at
// it (an analogy, a simpler breakdown, whatever the static text isn't landing
// with) without an admin having to write multiple versions up front.
exports.explainDifferently = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return aiUnavailable(res);
  try {
    const q = await prisma.question.findUnique({ where: { id: req.params.questionId } });
    if (!q) return res.status(404).json({ success: false, message: "Question not found" });

    const { style } = req.body; // optional: "simpler" | "analogy" | "stepbystep"
    const styleHint = { simpler: "Use very simple, plain language, as if for a beginner.", analogy: "Explain using a everyday analogy.", stepbystep: "Break it into clear numbered steps." }[style] || "";

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: "You are a patient NEET (Physics/Chemistry/Biology) tutor. Explain clearly and concisely for a student who already saw the standard explanation and is still confused. Do not just repeat the given explanation verbatim — genuinely re-explain it. Plain text only, no markdown headers.",
      messages: [{
        role: "user",
        content: `Subject: ${q.subject} | Chapter: ${q.chapter} | Topic: ${q.topic}
Question: ${q.questionText}
A) ${q.optionA}  B) ${q.optionB}  C) ${q.optionC}  D) ${q.optionD}
Correct answer: ${["A", "B", "C", "D"][q.correctOpt]}
Standard explanation already shown to the student: ${q.explanation}

${styleHint}
Give a fresh, genuinely different explanation of why the correct answer is right.`,
      }],
    });

    const text = msg.content.find((b) => b.type === "text")?.text || "";
    res.json({ success: true, explanation: text.trim() });
  } catch (err) {
    res.status(502).json({ success: false, message: "AI Mentor request failed: " + err.message });
  }
};

// ───────────────────────── Admin: AI content generation ─────────────────────────

const SCHEMAS = {
  question: {
    fields: "subject, classLevel, chapter, topic, difficulty (easy/medium/hard), questionText, optionA, optionB, optionC, optionD, correctOpt (0-3, integer), explanation",
    example: `{"subject":"Biology","classLevel":"12th","chapter":"Genetics","topic":"Mendelian Inheritance","difficulty":"medium","questionText":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctOpt":2,"explanation":"..."}`,
  },
  flashcard: {
    fields: "subject, classLevel, chapter, front (a question or term), back (the answer/definition)",
    example: `{"subject":"Biology","classLevel":"12th","chapter":"Genetics","front":"...","back":"..."}`,
  },
  formula: {
    fields: "subject, classLevel, chapter, title, expression (the formula itself), notes (when/how to use it)",
    example: `{"subject":"Physics","classLevel":"12th","chapter":"Electrostatics","title":"...","expression":"...","notes":"..."}`,
  },
};

// POST /api/v1/admin/ai/generate
// Body: { type: "question"|"flashcard"|"formula", subject, classLevel, chapter, count }
// Returns DRAFT items only — nothing is saved to the database here. The admin
// reviews, edits if needed, and saves each one individually (questions) or the
// whole batch (flashcards/formulas) from the review screen, same as anything
// typed by hand. This keeps a human in the loop before anything goes live for
// students, given an LLM can get a fact or a NEET-syllabus detail wrong.
// POST /api/v1/admin/ai/extract-questions
// Body: { imageBase64, mediaType, subject, classLevel }
// Reads a photo/scan of a real question paper page using Claude's vision and
// extracts every question on it into the same draft format as generateContent
// — reviewed and approved by the admin before anything is saved, same as
// everywhere else AI touches content here.
exports.extractQuestionsFromImage = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return aiUnavailable(res);
  const { imageBase64, mediaType, subject, classLevel } = req.body;
  if (!imageBase64 || !mediaType) return res.status(400).json({ success: false, message: "imageBase64 and mediaType are required" });
  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
    return res.status(400).json({ success: false, message: "Image must be JPEG, PNG, or WebP" });
  }

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `You transcribe NEET exam question papers from photos/scans into structured JSON. Respond with ONLY a raw JSON array, no prose, no markdown fences. Each item needs exactly these fields: subject, classLevel, chapter, topic, difficulty (easy/medium/hard — your best estimate), questionText, optionA, optionB, optionC, optionD, correctOpt (0-3 integer — leave your best guess if not marked on the page, but prefer the paper's own answer key if one is visible), explanation (write a brief one if the paper doesn't include one). Skip anything you genuinely cannot read clearly rather than guessing at garbled text.`,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: `Transcribe every multiple-choice question visible in this image.${subject ? ` Subject: ${subject}.` : ""}${classLevel ? ` Class level: ${classLevel}.` : ""} Return the JSON array now.` },
        ],
      }],
    });

    const text = msg.content.find((b) => b.type === "text")?.text || "";
    const items = extractJson(text);
    if (!Array.isArray(items)) throw new Error("AI did not return an array");
    if (items.length === 0) return res.status(422).json({ success: false, message: "No readable questions found in that image — try a clearer photo." });

    res.json({ success: true, items });
  } catch (err) {
    res.status(502).json({ success: false, message: "Question extraction failed: " + err.message });
  }
};

// POST /api/v1/planner/generate
// Reads the student's own profile (weak/strong subjects, target score, exam
// date, study hours/day) and asks Claude for a 4-week rolling plan — not the
// full months-until-exam span, since that would be a huge one-shot AI call
// and go stale fast anyway. The student re-generates every few weeks as their
// weak areas shift. Saves directly to StudyPlan and returns it.
exports.generateStudyPlan = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return aiUnavailable(res);
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { profile: true } });
    const p = user?.profile;
    if (!p) return res.status(400).json({ success: false, message: "Complete your profile first (target score, weak subjects) so the plan can be personalized." });

    const examDate = p.neetDate || `${p.examYear}-05-03`;
    const daysLeft = Math.max(1, Math.ceil((new Date(examDate) - new Date()) / 86400000));

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `You are a NEET (Physics/Chemistry/Biology) exam prep coach. Respond with ONLY a raw JSON object, no prose, no markdown fences. Shape exactly:
{"weeks":[{"weekNumber":1,"focus":"one-line summary of this week's priority","days":[{"day":"Monday","tasks":[{"id":"unique-string","text":"specific, concrete task","subject":"Physics|Chemistry|Biology|Mixed","done":false}]}]}]}
Generate exactly 4 weeks, 7 days each. 2-4 tasks per day. Weight tasks toward the student's weak subjects (more repetition, more practice questions) while keeping strong subjects on light maintenance. Mix task types: revising a specific chapter/topic, solving practice questions on the app, taking a mock test (schedule roughly one full mock test every 7-10 days), reviewing the mistake notebook. Be specific about chapter/topic names within the given subjects, not generic like "study physics".`,
      messages: [{
        role: "user",
        content: `Student class: ${p.class} | Target score: ${p.targetScore}/720 | Current score: ${p.currentScore || "not yet taken a mock"} | Study hours/day: ${p.studyHoursPerDay}
Weak subjects/topics: ${p.weakSubjects?.length ? p.weakSubjects.join(", ") : "not specified"}
Strong subjects/topics: ${p.strongSubjects?.length ? p.strongSubjects.join(", ") : "not specified"}
Days until NEET exam (${examDate}): ${daysLeft}

Generate the 4-week plan now.`,
      }],
    });

    const text = msg.content.find((b) => b.type === "text")?.text || "";
    const plan = extractJson(text);
    if (!plan?.weeks) throw new Error("AI did not return a valid plan structure");

    const saved = await prisma.studyPlan.upsert({
      where: { userId: req.user.id },
      update: { plan },
      create: { userId: req.user.id, plan },
    });
    res.json({ success: true, plan: saved.plan });
  } catch (err) {
    res.status(502).json({ success: false, message: "Plan generation failed: " + err.message });
  }
};

exports.generateContent = async (req, res) => {
  const { type, subject, classLevel, chapter, count } = req.body;
  const schema = SCHEMAS[type];
  if (!schema) return res.status(400).json({ success: false, message: "type must be 'question', 'flashcard', or 'formula'" });
  if (!subject || !classLevel || !chapter) return res.status(400).json({ success: false, message: "subject, classLevel, and chapter are required" });
  const n = Math.min(Math.max(Number(count) || 5, 1), 10);

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `You generate NEET exam prep content for Indian Class 6-12 / Dropper students, strictly scoped to the NCERT syllabus for the given chapter. Respond with ONLY a raw JSON array, no prose, no markdown fences, no explanation before or after. Each array item must be an object with exactly these fields: ${schema.fields}. Example of one item's shape: ${schema.example}`,
      messages: [{
        role: "user",
        content: `Generate ${n} distinct, high-quality ${type}${n > 1 ? "s" : ""} for:
Subject: ${subject}
Class: ${classLevel}
Chapter: ${chapter}
${type === "question" ? "Vary the difficulty and cover different sub-topics within the chapter. Make wrong options plausible, not obviously silly." : ""}
Return the JSON array now.`,
      }],
    });

    const text = msg.content.find((b) => b.type === "text")?.text || "";
    const items = extractJson(text);
    if (!Array.isArray(items)) throw new Error("AI did not return an array");

    res.json({ success: true, items });
  } catch (err) {
    res.status(502).json({ success: false, message: "AI generation failed: " + err.message });
  }
};
