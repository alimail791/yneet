import { useState } from "react";
import api from "../lib/api";

// "Still confused?" — asks the AI mentor (POST /ai/explain/:id) for a fresh
// explanation of the same question in a different style.
const LANGS = [
  ["en", "English"],
  ["ta", "தமிழ்"],
  ["te", "తెలుగు"],
  ["kn", "ಕನ್ನಡ"],
  ["hi", "हिंदी"],
];
const savedLang = () => { try { return localStorage.getItem("yn-explain-lang") || "en"; } catch { return "en"; } };

const STYLES = [
  ["simpler", "Simpler"],
  ["stepbystep", "Step by step"],
  ["analogy", "With an example"],
];

export default function ExplainDifferently({ questionId }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [lang, setLang] = useState(savedLang);
  if (!questionId) return null;

  const ask = async (style) => {
    setBusy(style); setErr("");
    try {
      const { data } = await api.post(`/ai/explain/${questionId}`, { style, lang });
      setText(data.explanation || "");
    } catch (e) {
      setErr(e?.response?.data?.message?.includes("configured") ? "AI explanations are not available right now." : "Couldn't get an explanation. Please try again.");
    } finally { setBusy(""); }
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>🤖 Still confused? Explain in</span>
        {LANGS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={lang === k}
            onClick={() => { setLang(k); try { localStorage.setItem("yn-explain-lang", k); } catch {} }}
            style={{ padding: "3px 10px", fontSize: 12, borderRadius: 999, cursor: "pointer", fontWeight: 600,
              border: "1px solid " + (lang === k ? "var(--blue-mid, #1e40af)" : "var(--gray3, #d1d5db)"),
              background: lang === k ? "var(--blue-mid, #1e40af)" : "transparent", color: lang === k ? "#fff" : "var(--text)" }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>How?</span>
        {STYLES.map(([k, label]) => (
          <button key={k} className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => ask(k)} style={{ padding: "3px 10px", fontSize: 12 }}>
            {busy === k ? "Thinking…" : label}
          </button>
        ))}
      </div>
      {err && <p style={{ fontSize: 12, color: "var(--red, #dc2626)", marginTop: 6 }}>{err}</p>}
      {text && (
        <div style={{ marginTop: 8, background: "var(--blue-light)", borderLeft: "3px solid var(--blue-mid)", padding: "10px 14px", borderRadius: "0 8px 8px 0", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line", color: "var(--text)" }}>
          {text}
        </div>
      )}
    </div>
  );
}
