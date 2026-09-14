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
exports.generateContent = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return aiUnavailable(res);
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
