import { useState } from "react";

const FAQS = [
  {
    q: "How do mock tests work?",
    a: "Go to Mock Tests, pick a full-length or subject-wise test, and start. You get the exact duration shown on the card. Once submitted, check Analysis for your subject-wise score, accuracy, and estimated AIR.",
  },
  {
    q: "What's the difference between Practice and Daily Quiz?",
    a: "Daily Quiz is a short 50-question mixed set you can take once a day for quick revision and XP. Practice is the full question bank — filter by subject, chapter, PYQ, or repeated questions, and go at your own pace.",
  },
  {
    q: "What is 'Recommended for You' on the Practice page?",
    a: "It looks at your own mistake history and finds your top 3 weakest chapters, then serves questions from those first — so you spend time where it actually helps instead of browsing randomly.",
  },
  {
    q: "How does the Mistake Notebook work?",
    a: "Every question you get wrong in a mock test, quiz, or practice is logged here automatically, grouped by subject and chapter. You can review the explanation anytime, and use 'Ask AI Mentor' for a different, more detailed explanation if the standard one isn't clicking.",
  },
  {
    q: "How does the Study Planner work?",
    a: "Fill in your target score, weak subjects, and study hours in Profile, then generate a plan from the Planner tab. It builds a personalized 4-week day-by-day plan weighted toward your weak areas, with mock tests scheduled in. Regenerate it anytime as your weak areas shift.",
  },
  {
    q: "How does Refer & Earn work?",
    a: "Share your referral link (found on the Refer & Earn page) with a friend. Once they register through it and buy the Monthly plan, you automatically get a free month added to your own subscription.",
  },
  {
    q: "Can I get a refund?",
    a: "Refunds are handled case by case — reach out via WhatsApp below with your payment details and we'll sort it out.",
  },
  {
    q: "My subscription expired but I was still charged / didn't renew automatically",
    a: "YNeet plans don't auto-renew — you'll get an email reminder a few days before expiry, and you can renew manually from the Pricing page anytime. If something looks wrong with a payment, message us on WhatsApp.",
  },
  {
    q: "I found a wrong answer or a typo in a question",
    a: "Message us on WhatsApp with the question text or a screenshot — we review and fix these directly.",
  },
];

const WHATSAPP_NUMBER = "919443424064";
const WHATSAPP_MESSAGE = "Hi YNeet, I need help with something in the app.";

export default function HelpPage() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-title">❓ Help &amp; FAQ</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Common questions about using YNeet — or message us directly if you're stuck.</p>
        </div>
      </div>

      <div className="card mb-5" style={{ background: "var(--blue-light)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--blue)" }}>Still stuck?</p>
            <p style={{ fontSize: 13, color: "var(--text2)" }}>Message us on WhatsApp — usually a quick reply.</p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-blue"
          >
            💬 Chat on WhatsApp
          </a>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {FAQS.map((item, i) => {
          const open = openIdx === i;
          return (
            <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div
                onClick={() => setOpenIdx(open ? null : i)}
                style={{ padding: "16px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{item.q}</span>
                <span style={{ fontSize: 16, color: "var(--text3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>▾</span>
              </div>
              {open && (
                <div style={{ padding: "0 18px 16px", fontSize: 13.5, color: "var(--text2)", lineHeight: 1.7 }}>
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
