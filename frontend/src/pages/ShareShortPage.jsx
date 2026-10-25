import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ShortPlayer } from "./ShortsPage";

const API = import.meta.env.VITE_API_URL || "/api/v1";
const SIGNUP = (import.meta.env.VITE_RAISE_ACADEMY_URL || "https://www.yneet.in").replace(/\/$/, "") + "/neet-trial";

// Public page for a featured Short (app.yneet.in/s/:id). No login: this is what
// creators share on WhatsApp/Instagram — it plays the video, credits their
// channel, and invites the viewer to try YNeet.
export default function ShareShortPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null); setError("");
    axios.get(`${API}/public/shorts/${id}`)
      .then(r => { setData(r.data); document.title = `${r.data.short.title} · YNeet Shorts`; })
      .catch(e => setError(e?.response?.data?.message || "Couldn't load this Short."));
    window.scrollTo(0, 0);
  }, [id]);

  const track = () => { try { window.gtag?.("event", "share_short_play", { short_id: id }); } catch { /* ignore */ } };

  if (error) return (
    <div className="auth-page"><div className="auth-card text-center">
      <div style={{ fontSize: 40 }}>🎬</div>
      <p style={{ fontWeight: 700, margin: "8px 0" }}>{error}</p>
      <a className="btn btn-blue" href={SIGNUP}>Explore YNeet</a>
    </div></div>
  );
  if (!data) return <div className="loading-screen"><div className="spinner"></div></div>;

  const { short: s, more } = data;
  const c = s.creator;

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)" }}>
      <nav className="app-nav">
        <div className="nav-logo">YNeet 🎯</div>
        <a className="btn btn-blue btn-sm" href={SIGNUP}>Try free</a>
      </nav>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 14px 40px" }}>
        <div className="short-card" style={{ height: "auto" }}>
          <div className="short-video" style={{ aspectRatio: "9 / 14", flex: "none" }}>
            <ShortPlayer key={s.id} short={s} active onPlay={track} />
          </div>
          <div className="short-info" style={{ maxHeight: "none" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <span className="chip chip-blue">{s.subject}</span>
              <span className="chip" style={{ background: "var(--gray2)", color: "var(--text2)" }}>{s.chapter}</span>
              {s.language !== "English" && <span className="chip chip-amber">{s.language}</span>}
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>{s.title}</h1>
            {s.description && <p style={{ fontSize: 13.5, color: "var(--text2)", marginTop: 4 }}>{s.description}</p>}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "10px 12px", background: "var(--gray2)", borderRadius: 12 }}>
              <div className="avatar" style={{ width: 38, height: 38, fontSize: 14, flexShrink: 0 }}>
                {(c?.name || s.creatorName).split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 14 }}>{c?.name || s.creatorName}</p>
                <p style={{ fontSize: 12, color: "var(--text3)" }}>YNeet creator</p>
              </div>
              {c?.youtubeUrl && <a className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} href={c.youtubeUrl} target="_blank" rel="noreferrer">YouTube</a>}
              {c?.instagramUrl && <a className="btn btn-sm btn-purple" href={c.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}
            </div>
          </div>
        </div>

        <div className="motiv-card" style={{ marginTop: 16, textAlign: "center" }}>
          <p style={{ fontWeight: 800, fontSize: 17 }}>Learn every NEET concept like this</p>
          <p style={{ fontSize: 13.5, opacity: 0.9, margin: "4px 0 12px" }}>Shorts, mock tests, daily quiz and doubt support. 30 days free. Free for Class 6–8.</p>
          <a className="btn" style={{ background: "#fff", color: "var(--blue)" }} href={SIGNUP}>Start free on YNeet</a>
        </div>

        {more.length > 0 && (
          <>
            <p style={{ fontWeight: 800, margin: "20px 0 10px" }}>More Shorts</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
              {more.map(m => (
                <Link key={m.id} to={`/s/${m.id}`} className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "16/9", background: m.provider === "youtube" ? `#0f172a url(https://i.ytimg.com/vi/${m.videoRef}/mqdefault.jpg) center/cover` : "linear-gradient(150deg,var(--blue),var(--purple))" }} />
                  <div style={{ padding: "8px 10px" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{m.title}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text3)" }}>{m.creator?.name || m.creatorName}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
