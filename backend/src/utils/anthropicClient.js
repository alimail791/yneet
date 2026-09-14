const Anthropic = require("@anthropic-ai/sdk");

// Shared client for both the student-facing AI Mentor ("explain this
// differently") and the admin content-generation tools. Requires
// ANTHROPIC_API_KEY in .env — every caller should handle a missing/invalid
// key gracefully (see aiController.js) rather than crashing the request.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claude sometimes wraps JSON in prose or a ```json fence despite instructions
// not to — this strips both so JSON.parse doesn't choke on real responses.
const extractJson = (text) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (start === -1 || end === -1) throw new Error("No JSON found in AI response");
  return JSON.parse(raw.slice(start, end + 1));
};

module.exports = { anthropic, extractJson, MODEL: "claude-sonnet-4-6" };
