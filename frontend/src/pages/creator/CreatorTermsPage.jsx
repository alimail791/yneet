// YNeet Creator Terms (version 2026-11-03). Keep in step with
// backend/src/utils/creatorTerms.js — bump TERMS_VERSION there when this changes.
import { Link } from "react-router-dom";

export const TERMS_UPDATED = "3 November 2026";

export function CreatorTermsText() {
  const h = { fontSize: 16, fontWeight: 800, marginTop: 18, marginBottom: 6 };
  const ul = { paddingLeft: 20, display: "grid", gap: 6, fontSize: 14, lineHeight: 1.6, color: "var(--text2)" };
  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
        These terms are between you (the creator) and Raise Academy, which runs YNeet. They apply to every Short you submit.
      </p>

      <p style={h}>1. Payment: one time, per approved Short</p>
      <ul style={ul}>
        <li>You get a <strong>one-time payment</strong> for each Short that YNeet approves: ₹500, or the rate shown on your dashboard when you submit it.</li>
        <li>There is no further payment for the same Short, however long it stays on YNeet or however many students watch it.</li>
        <li>Shorts that are not approved are not paid.</li>
      </ul>

      <p style={h}>2. When you're paid</p>
      <ul style={ul}>
        <li>Every Monday, all your Shorts approved in the previous week (Monday to Sunday) are added up into one payment.</li>
        <li>We pay to the UPI ID or bank details in your profile. Keep them correct; we're not responsible for payments sent to details you gave us.</li>
        <li>You are responsible for your own income tax. YNeet may deduct tax (TDS) where the law requires it.</li>
      </ul>

      <p style={h}>3. What YNeet can do with a paid Short</p>
      <ul style={ul}>
        <li>Show it in the YNeet app and on yneet.in, permanently, with no further payment.</li>
        <li>Add quick-check questions, captions or translations, and use short clips of it to promote YNeet.</li>
        <li>Show your name, and your channel link where we show creator credits.</li>
      </ul>

      <p style={h}>4. What stays yours</p>
      <ul style={ul}>
        <li>You keep ownership of your video. You can also post it on your own YouTube, Instagram or other channels.</li>
        <li>Please don't give another company exclusive rights to it that would stop YNeet from using it.</li>
        <li>Keep the video available at the link you submitted (for example, Unlisted on YouTube). If it's deleted or made private, YNeet can't show it.</li>
      </ul>

      <p style={h}>5. Content rules</p>
      <ul style={ul}>
        <li>It must be your own original work, and correct according to the NCERT syllabus.</li>
        <li>No music, images or video clips you don't have the right to use.</li>
        <li>No advertising for other coaching centres or apps, and no personal phone numbers asking students to contact you.</li>
      </ul>

      <p style={h}>6. Removal</p>
      <ul style={ul}>
        <li>YNeet can stop showing any Short at any time, for example if we find a mistake in it.</li>
        <li>You can withdraw a Short that hasn't been approved yet at any time. For a Short that has been paid, message us and we'll look at your request.</li>
      </ul>

      <p style={h}>7. Changes</p>
      <ul style={ul}>
        <li>If these terms change, we'll show the new version on your dashboard to accept before your next upload. Shorts you already submitted stay under the terms you accepted then.</li>
      </ul>

      <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 18 }}>
        Questions? WhatsApp YNeet on +91 94434 24064. Last updated {TERMS_UPDATED}.
      </p>
    </div>
  );
}

export default function CreatorTermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "24px 16px 48px" }}>
      <div className="card" style={{ maxWidth: 720, margin: "0 auto", padding: 28 }}>
        <Link to="/creator" style={{ fontSize: 14, color: "var(--blue-mid)", fontWeight: 600 }}>← YNeet Creators</Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "10px 0 6px" }}>YNeet Creator Terms</h1>
        <CreatorTermsText />
      </div>
    </div>
  );
}
