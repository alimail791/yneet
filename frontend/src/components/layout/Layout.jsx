import { useState, useEffect } from "react";
import { isAppMode, WEBSITE_URL } from "../../utils/appMode";
import { pushIsOn } from "../../utils/push";
import api from "../../lib/api";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import InstallPrompt from "../InstallPrompt";
import { isJuniorFree, PUZZLES_URL } from "../../utils/plan";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [expiryNotice, setExpiryNotice] = useState(null); // null | { hoursLeft, endDate }
  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const streak = user?.streak?.current || 0;
  // Free Class 6–8 students only see the free pages (Home, Shorts, Quiz, Tests, Puzzles).
  const junior = isJuniorFree(user);

  // Show a one-time-per-login popup if the subscription is in its final day.
  // sessionStorage means it won't nag on every page navigation within the same
  // login, but it WILL show again next time they log in (new browser session).
  useEffect(() => {
    const sub = user?.subscription;
    if (!sub?.endDate || sub.status !== "active") return;
    const end = new Date(sub.endDate);
    const hoursLeft = (end - new Date()) / (1000 * 60 * 60);
    if (hoursLeft > 0 && hoursLeft <= 24 && !sessionStorage.getItem("yneet_expiry_notice_shown")) {
      setExpiryNotice({ hoursLeft, endDate: end });
      sessionStorage.setItem("yneet_expiry_notice_shown", "1");
    }
  }, [user?.subscription?.endDate, user?.subscription?.status]);

  // If this device already has reminders on, re-link it to whoever is signed in now
  // (covers a shared phone, a re-install, or a subscription Chrome renewed).
  useEffect(() => {
    if (!user?.id) return;
    pushIsOn().then(async (on) => {
      if (!on) return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) api.post("/push/subscribe", { subscription: sub.toJSON(), inApp: isAppMode }).catch(() => {});
    }).catch(() => {});
  }, [user?.id]);

  // Refer & Earn nudge: shown at most once per calendar day (per browser) to
  // encourage referrals. localStorage can be unavailable (private mode), so
  // every access is guarded and the popup simply doesn't show in that case.
  const [referralPopup, setReferralPopup] = useState(false);
  useEffect(() => {
    if (junior) return; // Refer & Earn is a paid-plan reward
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem("yneet_referral_popup_day") !== today) {
        localStorage.setItem("yneet_referral_popup_day", today);
        const t = setTimeout(() => setReferralPopup(true), 1500);
        return () => clearTimeout(t);
      }
    } catch { /* storage unavailable — skip the popup */ }
  }, [junior]);

  const allTabs = [
    { to: "/",         label: "Dashboard", end: true },
    { to: "/mock",     label: "Mock Tests" },
    { to: "/shorts",   label: "Shorts" },
    { to: "/quiz",     label: "Daily Quiz" },
    { to: "/practice", label: "Practice" },
    { to: "/pyq",      label: "PYQs" },
    { to: "/weightage", label: "Chapter Priority" },
    { to: "/planner",  label: "Planner" },
    { to: "/leaderboard", label: "Leaderboard" }, 
    { to: "/sprint",   label: "60-Second Sprint" },
    { to: "/maps",     label: "Concept Maps" },
    { to: "/teaser",   label: "Brain Teaser" },
    { to: "/ask",      label: "Ask a Doubt" },
    { to: "/biology",  label: "Biology" },
    { to: "/physics",  label: "Physics" },
    { to: "/chemistry",label: "Chemistry" },
    { to: "/mistakes", label: "Mistakes" },
    { to: "/referral", label: "Refer & Earn" },
    { to: "/help", label: "Help & FAQ", icon: "❓" },
  ];

  const juniorTabs = [
    { to: "/",       label: "Home", end: true },
    { to: "/shorts", label: "Shorts" },
    { to: "/quiz",   label: "Daily Quiz" },
    { to: "/mock",   label: "Tests" },
    { href: PUZZLES_URL, label: "Daily Puzzles" },
    { to: "/sprint", label: "60-Second Sprint" },
    { to: "/teaser", label: "Brain Teaser" },
    { to: "/ask",    label: "Ask a Doubt" },
    { to: "/help",   label: "Help & FAQ" },
  ];
  const tabs = junior ? juniorTabs : allTabs;

  const allMobileTabs = [
    { to: "/",         label: "Home",      icon: "🏠", end: true },
    { to: "/mock",     label: "Tests",     icon: "📝" },
    { to: "/shorts",   label: "Shorts",    icon: "🎬" },
    { to: "/quiz",     label: "Quiz",      icon: "⚡" },
    { to: "/practice", label: "Practice",  icon: "📖" },
  ];

  const juniorMobileTabs = [
    { to: "/",       label: "Home",    icon: "🏠", end: true },
    { to: "/shorts", label: "Shorts",  icon: "🎬" },
    { to: "/quiz",   label: "Quiz",    icon: "⚡" },
    { to: "/mock",   label: "Tests",   icon: "📝" },
    { href: PUZZLES_URL, label: "Puzzles", icon: "🧩" },
  ];
  const mobileTabs = junior ? juniorMobileTabs : allMobileTabs;

  // Everything that doesn't fit in the 5-slot bottom bar lives behind "More".
  // In the Play Store app: every free page from the website (Explore screen).
  const freeLink = isAppMode ? [{ to: "/explore", label: "Free resources", icon: "📚" }] : [];
  const moreLinks = junior ? [
    ...freeLink,
    { to: "/profile", label: "Profile",    icon: "👤" },
    { to: "/help",    label: "Help & FAQ", icon: "❓" },
  ] : [
    { to: "/pyq",        label: "Previous Year Qs",   icon: "📅" },
    { to: "/biology",   label: "Biology Flashcards", icon: "🧬" },
    { to: "/physics",   label: "Physics Formulas",   icon: "⚛️" },
    { to: "/chemistry", label: "Chemistry Hub",      icon: "🧪" },
    { to: "/mistakes",  label: "Mistake Notebook",   icon: "❌" },
    { to: "/weightage", label: "Chapter Priority",   icon: "🎯" },
    { to: "/planner",   label: "Study Planner",      icon: "🗓️" },
    { to: "/leaderboard", label: "Leaderboard",      icon: "🏆" },
    { to: "/referral",  label: "Refer & Earn",       icon: "🎁" },
    ...freeLink,
    { to: "/profile",   label: "Profile",            icon: "👤" },
    ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin Panel", icon: "⚙️" }] : []),
  ];

  return (
    <>
      <InstallPrompt />
      <nav className="app-nav">
        {isAppMode
          ? <div className="nav-logo">YNeet 🎯</div>
          : <a href={WEBSITE_URL} className="nav-logo" title="Go to the YNeet website (yneet.in)" style={{ textDecoration: "none" }}>YNeet 🎯</a>}
        <div className="nav-tabs">
          {tabs.map(t => t.href ? (
            <a key={t.href} href={t.href} target="_blank" rel="noreferrer"><button className="nav-tab">{t.label} ↗</button></a>
          ) : (
            <NavLink key={t.to} to={t.to} end={t.end}>
              {({ isActive }) => (
                <button className={`nav-tab${isActive ? " active" : ""}`}>{t.label}</button>
              )}
            </NavLink>
          ))}
        </div>
        <div className="nav-right">
          {streak > 0 && <span className="streak-badge">🔥 {streak}</span>}
          {user?.role === "admin" && (
            <button className="btn btn-outline btn-sm" onClick={() => navigate("/admin")}>⚙️ Admin</button>
          )}
          {!isAppMode && <a href={WEBSITE_URL} className="btn btn-outline btn-sm nav-website" title="Go to the YNeet website">🌐 yneet.in</a>}
          <button className="avatar" onClick={() => navigate("/profile")} title="Profile">{initials}</button>
          <button className="btn btn-outline btn-sm" onClick={logout}>Logout</button>
        </div>
      </nav>

      {user?.verification?.required && !user?.verification?.blocked && (
        <div style={{ background: "#ecfdf5", borderBottom: "1px solid #a7f3d0", padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "center", fontSize: 14 }}>
          <span>📱 Confirm your WhatsApp number to keep your free trial{user.verification.deadline ? ` — ${Math.max(0, Math.ceil((new Date(user.verification.deadline) - Date.now()) / 864e5))} day(s) left` : ""}.</span>
          <button className="btn btn-sm" style={{ background: "#25D366", color: "#fff", border: "none", fontWeight: 700 }} onClick={() => navigate("/verify")}>Verify now</button>
        </div>
      )}

      <div className="page-content">
        <Outlet />
      </div>

      {expiryNotice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⏰</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Your plan ends today!</h2>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 20 }}>
              Your subscription expires at {expiryNotice.endDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} today ({expiryNotice.endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}).
              {isAppMode ? "After that, mock tests, quizzes, flashcards and formulas will be locked until your plan is active again." : "Renew now to keep access to mock tests, quizzes, flashcards and formulas without interruption."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {isAppMode ? (
                <button className="btn btn-blue" onClick={() => setExpiryNotice(null)}>OK</button>
              ) : (
                <>
                  <button className="btn btn-outline" onClick={() => setExpiryNotice(null)}>Later</button>
                  <button className="btn btn-blue" onClick={() => { setExpiryNotice(null); navigate("/pricing"); }}>Renew Now</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {referralPopup && !expiryNotice && (
        <div onClick={() => setReferralPopup(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 28, maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎁</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Get 15 days of YNeet free!</h2>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 20 }}>
              Every friend who joins with your link and confirms their WhatsApp number gets you 15 days free. 2 friends = 1 month. Share your link in just a tap.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-outline" onClick={() => setReferralPopup(false)}>Maybe later</button>
              <button className="btn btn-blue" onClick={() => { setReferralPopup(false); navigate("/referral"); }}>Refer &amp; Earn</button>
            </div>
          </div>
        </div>
      )}

      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "20px 20px 0 0", padding: "10px 8px calc(env(safe-area-inset-bottom, 0px) + 10px)", boxShadow: "0 -8px 24px rgba(0,0,0,.12)" }}
          >
            <div style={{ width: 36, height: 4, background: "var(--gray3)", borderRadius: 2, margin: "6px auto 14px" }} />
            {!isAppMode && (
              <a href={WEBSITE_URL} style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                  <span style={{ fontSize: 20 }}>🌐</span>
                  YNeet website (yneet.in)
                </div>
              </a>
            )}
            {moreLinks.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMoreOpen(false)}
                style={{ textDecoration: "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                  <span style={{ fontSize: 20 }}>{l.icon}</span>
                  {l.label}
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav">
        {mobileTabs.map(t => t.href ? (
          <a key={t.href} href={t.href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button className="mob-tab"><span>{t.icon}</span><span>{t.label}</span></button>
          </a>
        ) : (
          <NavLink key={t.to} to={t.to} end={t.end}>
            {({ isActive }) => (
              <button className={`mob-tab${isActive ? " active" : ""}`}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            )}
          </NavLink>
        ))}
        <button className="mob-tab" onClick={() => setMoreOpen(true)}>
          <span>☰</span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
