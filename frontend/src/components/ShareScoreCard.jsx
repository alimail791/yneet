import { useEffect, useState } from "react";
import api from "../lib/api";

// "Share my score" on the mock test analysis page. Makes a 1080x1350 score-card
// image (fits WhatsApp status and Instagram) and a WhatsApp message, both with
// the student's own referral link, so every friend who joins and confirms their
// WhatsApp number earns the student 15 free days (Refer & Earn).
const SITE = "https://www.yneet.in/register";
const track = (event, params) => { try { window.gtag?.("event", event, params); } catch { /* analytics only */ } };

function withUtm(url, medium) {
  const u = new URL(url || SITE, "https://www.yneet.in");
  u.searchParams.set("utm_source", "score_card");
  u.searchParams.set("utm_medium", medium);
  return u.toString();
}

function wrap(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

async function makeCard({ score, total, title, physics, chemistry, biology, accuracy, code }) {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0f172a"); g.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  ctx.fillStyle = "#fbbf24"; ctx.font = "800 64px system-ui, sans-serif";
  ctx.fillText("YNeet", W / 2, 140);
  ctx.fillStyle = "#cbd5e1"; ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText("My NEET mock test score", W / 2, 215);

  ctx.fillStyle = "#ffffff"; ctx.font = "900 220px system-ui, sans-serif";
  ctx.fillText(String(score), W / 2, 490);
  ctx.fillStyle = "#94a3b8"; ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText(`out of ${total}`, W / 2, 570);

  ctx.fillStyle = "#e2e8f0"; ctx.font = "600 38px system-ui, sans-serif";
  wrap(ctx, title, W - 160).forEach((l, i) => ctx.fillText(l, W / 2, 660 + i * 50));

  const subs = [["Physics", physics, "#60a5fa"], ["Chemistry", chemistry, "#fbbf24"], ["Biology", biology, "#34d399"]];
  subs.forEach(([name, v, col], i) => {
    const x = 200 + i * 340;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.roundRect?.(x - 140, 770, 280, 170, 28); ctx.fill();
    ctx.fillStyle = col; ctx.font = "800 72px system-ui, sans-serif";
    ctx.fillText(String(v ?? 0), x, 870);
    ctx.fillStyle = "#cbd5e1"; ctx.font = "600 32px system-ui, sans-serif";
    ctx.fillText(name, x, 915);
  });
  if (accuracy != null) {
    ctx.fillStyle = "#cbd5e1"; ctx.font = "600 40px system-ui, sans-serif";
    ctx.fillText(`Accuracy ${Number(accuracy).toFixed(0)}%`, W / 2, 1015);
  }

  ctx.fillStyle = "#fbbf24";
  ctx.beginPath(); ctx.roundRect?.(110, 1080, W - 220, 150, 75); ctx.fill();
  ctx.fillStyle = "#0f172a"; ctx.font = "800 46px system-ui, sans-serif";
  ctx.fillText("Can you beat my score?", W / 2, 1145);
  ctx.font = "700 36px system-ui, sans-serif";
  // yneet.in/r/<code> redirects to sign-up with the referral code (www serve.json).
  ctx.fillText(code ? `yneet.in/r/${code} · 30 days free` : "yneet.in · 30 days free", W / 2, 1197);

  ctx.fillStyle = "#94a3b8"; ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillText("Full NEET mocks, PYQs and your All India Rank", W / 2, 1290);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

export default function ShareScoreCard({ attempt }) {
  const [ref, setRef] = useState({ url: SITE, code: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/user/referral").then((r) => setRef({ url: r.data.registerUrl || SITE, code: r.data.referralCode || "" })).catch(() => {});
  }, []);

  const total = attempt.totalMarks || 720;
  const title = attempt.mockTest?.title || "NEET mock test";
  const text = (medium) => `I scored ${attempt.score}/${total} in a NEET mock test on YNeet (${title}). Can you beat it? Start 30 days free with my link: ${withUtm(ref.url, medium)}`;

  const shareCard = async () => {
    setBusy(true);
    track("score_card_share", { method: "card" });
    try {
      const blob = await makeCard({
        score: attempt.score, total, title, physics: attempt.physicsScore, chemistry: attempt.chemScore,
        biology: attempt.bioScore, accuracy: attempt.accuracy, code: ref.code,
      });
      if (!blob) return;
      const file = new File([blob], "my-neet-mock-score.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text: text("card") }); return; } catch { /* cancelled */ }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    } finally { setBusy(false); }
  };

  return (
    <div className="card mb-5" style={{ background: "linear-gradient(135deg, #0f172a, #1e3a8a)", color: "#fff", borderColor: "transparent" }}>
      <div className="section-title" style={{ color: "#fff" }}>Challenge your friends</div>
      <p style={{ fontSize: 14, opacity: 0.85, margin: "6px 0 14px" }}>
        Share your score card on WhatsApp status or Instagram. Each friend who joins with your link and confirms their WhatsApp number gives you 15 days free.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="btn btn-sm" style={{ background: "#25D366", color: "#fff", fontWeight: 700 }}
          href={`https://wa.me/?text=${encodeURIComponent(text("whatsapp"))}`} target="_blank" rel="noopener noreferrer"
          onClick={() => track("score_card_share", { method: "whatsapp" })}>
          Send on WhatsApp
        </a>
        <button className="btn btn-sm" style={{ background: "#fbbf24", color: "#0f172a", fontWeight: 700 }} onClick={shareCard} disabled={busy}>
          {busy ? "Making card…" : "Share score card image"}
        </button>
      </div>
    </div>
  );
}
