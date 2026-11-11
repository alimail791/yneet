import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PUZZLES_URL } from "../utils/plan";

// /explore — the Android app's welcome screen. Everyone can try every free
// feature from www.yneet.in here before creating an account (they open full
// screen inside the app via /explore/open, with prices hidden). Logged-in
// students reach it from the More menu ("Free resources").
//
// No prices, plans or payment links: the Play Store app is "consumption only".
const WA_NUMBER = "919443424064";
const WA_TEXT = "Hi YNeet, I have a question about NEET preparation.";
const WA_CHANNEL = "https://whatsapp.com/channel/0029Va6DPU1JkK7E9QxsrM36";

const open = (p, t) => `/explore/open?p=${encodeURIComponent(p)}&t=${encodeURIComponent(t)}`;

const SECTIONS = [
  {
    title: "NEET exam tools",
    items: [
      { icon: "🧮", title: "NEET Score Calculator", desc: "Match your answers with the answer key. Score, rank and colleges.", to: open("/neet-score-calculator", "Score Calculator") },
      { icon: "🏥", title: "NEET College Predictor", desc: "See which medical colleges your rank or score can get.", to: open("/neet-college-predictor", "College Predictor") },
      { icon: "📊", title: "NEET cutoff by state", desc: "Last year's closing rank for every government MBBS college.", to: open("/neet-cutoff", "NEET cutoff") },
      { icon: "📝", title: "NEET Registration Guide", desc: "Eligibility check, document checklist and form steps.", to: open("/neet-registration", "Registration Guide") },
      { icon: "📷", title: "Photo & Signature Resizer", desc: "Resize your NEET photo, signature and thumb to the right KB.", to: open("/neet-photo-resizer", "Photo Resizer") },
      { icon: "📅", title: "NEET 2027 exam date", desc: "Exam date, pattern and marking scheme.", to: open("/neet-2027-exam-date", "NEET 2027 exam date") },
    ],
  },
  {
    title: "Practise & test yourself",
    items: [
      { icon: "🎯", title: "NEET Readiness Test", desc: "15 questions, 5 minutes. Get your score and weak chapters.", to: open("/neet-readiness", "NEET Readiness Test") },
      { icon: "⚡", title: "60-Second Sprint", desc: "Today's quick challenge with a leaderboard.", to: open("/neet-sprint", "60-Second Sprint") },
      { icon: "❓", title: "Question of the Day", desc: "One NEET question every day, with the answer explained.", to: open("/neet-question-of-the-day", "Question of the Day") },
      { icon: "📚", title: "Chapter-wise PYQs", desc: "Previous-year NEET questions for every chapter.", to: open("/neet-practice", "Chapter-wise PYQs") },
      { icon: "🗂️", title: "NEET papers by year", desc: "Past NEET question papers, year by year.", to: open("/neet-question-papers", "NEET papers by year") },
      { icon: "📥", title: "Free PYQ PDFs", desc: "Every NEET PYQ of a chapter with solutions, as a PDF.", to: open("/neet-pyq-books", "NEET PYQ PDFs") },
      { icon: "⚖️", title: "Chapter-wise weightage", desc: "How many NEET questions each chapter is worth.", to: open("/neet-chapter-wise-weightage", "Chapter-wise weightage") },
      { icon: "🧩", title: "Daily NEET puzzles", desc: "5 quick science puzzles every day.", href: PUZZLES_URL },
    ],
  },
  {
    title: "Learn & revise",
    items: [
      { icon: "🗺️", title: "Concept Maps", desc: "One-page chapter summaries for quick revision.", to: open("/neet-concept-maps", "Concept Maps") },
      { icon: "📖", title: "NCERT Biology notes", desc: "Chapter notes that follow your NCERT book.", to: open("/ncert-notes", "NCERT Biology notes") },
      { icon: "🎬", title: "YNeet Shorts", desc: "Quick concept videos from teachers.", to: open("/neet-shorts", "YNeet Shorts") },
      { icon: "💬", title: "Ask YNeet", desc: "Students' doubts, answered clearly.", to: open("/ask-yneet", "Ask YNeet") },
      { icon: "📰", title: "NEET guides", desc: "Study plans, cutoffs and exam tips.", to: open("/blog", "NEET guides") },
    ],
  },
  {
    title: "Class 6–8",
    items: [
      { icon: "🧠", title: "Brain Teaser", desc: "A tricky science question every week.", to: open("/brain-teaser", "Brain Teaser") },
    ],
  },
  {
    title: "About NEET & YNeet",
    items: [
      { icon: "🎁", title: "What you get free", desc: "Everything in your free 30 days.", to: open("/neet-trial", "What you get free") },
      { icon: "👨‍👩‍👧", title: "For parents", desc: "Weekly progress reports and what your child gets.", to: open("/neet-parents", "For parents") },
      { icon: "🏫", title: "About Raise Academy", desc: "Who we are, in Avadi, Chennai.", to: open("/about", "About us") },
      { icon: "🛟", title: "Help & FAQ", desc: "Answers to common questions.", to: open("/help", "Help & FAQ") },
    ],
  },
  {
    title: "Talk to us",
    items: [
      { icon: "🟢", title: "Chat on WhatsApp", desc: "Ask us anything. We usually reply quickly.", href: `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_TEXT)}` },
      { icon: "📣", title: "Daily NEET Question channel", desc: "Follow our free WhatsApp channel.", href: WA_CHANNEL },
    ],
  },
];

function Tile({ item }) {
  const body = (
    <div className="card" style={{ height: "100%", display: "flex", gap: 12, alignItems: "flex-start", padding: 14, margin: 0 }}>
      <div style={{ fontSize: 26, lineHeight: 1 }}>{item.icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{item.title}{item.href ? " ↗" : ""}</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{item.desc}</div>
      </div>
    </div>
  );
  return item.href
    ? <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>{body}</a>
    : <Link to={item.to} style={{ textDecoration: "none", color: "inherit" }}>{body}</Link>;
}

export default function ExplorePage() {
  const { user } = useAuth();
  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)" }}>
      <div style={{ background: "linear-gradient(150deg,#4f46e5,#2a1f99)", color: "#fff", padding: "28px 18px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/icons/icon-192.png" alt="" width="40" height="40" style={{ borderRadius: 10 }} />
          <span style={{ fontWeight: 800, fontSize: 22 }}>YNeet</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "18px 0 6px", lineHeight: 1.2 }}>NEET prep that fits your class</h1>
        <p style={{ fontSize: 14.5, opacity: 0.9 }}>Free for Class 6–8 · 30 days free for Class 9–12 &amp; droppers. Try everything below, no login needed.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          {user ? (
            <Link to="/" className="btn" style={{ background: "#f5a623", color: "#1e1b4b", fontWeight: 800 }}>Go to my YNeet →</Link>
          ) : (
            <>
              <Link to="/account?page=register" className="btn" style={{ background: "#f5a623", color: "#1e1b4b", fontWeight: 800 }}>Create free account</Link>
              <Link to="/account?page=login" className="btn" style={{ background: "rgba(255,255,255,.15)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,.4)" }}>Log in</Link>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 14px 40px" }}>
        {user && ["11th", "12th", "Dropper"].includes(user.profile?.class) && (
          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text3)", margin: "0 2px 10px" }}>Your plan</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              <Tile item={{ icon: "🎯", title: "Chapter Priority", desc: "Which chapters cost you the most marks, and a day-by-day plan to exam day.", to: "/weightage" }} />
            </div>
          </section>
        )}
        {SECTIONS.map((s) => (
          <section key={s.title} style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text3)", margin: "0 2px 10px" }}>{s.title}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {s.items.map((it) => <Tile key={it.title} item={it} />)}
            </div>
          </section>
        ))}

        {!user && (
          <div className="card" style={{ marginTop: 22, textAlign: "center", padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Save your scores and streaks</div>
            <p style={{ fontSize: 13.5, color: "var(--text2)", margin: "6px 0 14px" }}>Create a free account for full mock tests, practice by chapter, AI explanations in 5 languages and parent reports.</p>
            <Link to="/account?page=register" className="btn btn-purple">Create free account</Link>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--text3)", marginTop: 22 }}>
          <Link to={open("/terms", "Terms of Service")} style={{ color: "inherit" }}>Terms</Link> ·{" "}
          <Link to={open("/privacy", "Privacy policy")} style={{ color: "inherit" }}>Privacy</Link> · Raise Academy, Chennai
        </p>
      </div>
    </div>
  );
}
