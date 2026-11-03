// Concept Maps: one chapter on one page, a new one every Monday.
// /maps = the list; /maps/:id = one map, with "Practise this chapter".
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import MapView from "../components/weekly/MapView";
import { drawMapPost } from "../utils/postImage";
import { useAuth } from "../context/AuthContext";
import { isJuniorFree } from "../utils/plan";

const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const shell = (children) => (
  <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "18px 16px 40px" }}>
    <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 14 }}>{children}</div>
  </div>
);

export default function ConceptMapsPage() {
  const { id } = useParams();
  return id ? <OneMap id={id} /> : <MapList />;
}

function MapList() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/weekly/maps").then((r) => setData(r.data)).catch(() => setData({ maps: [] })); }, []);
  if (!data) return shell(<div className="loading-screen"><div className="spinner"></div></div>);
  return shell(
    <>
      <Link to="/" style={{ fontSize: 14, color: "var(--blue-mid)", fontWeight: 600 }}>← Home</Link>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Concept Maps</h1>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>A whole chapter on one page. A new one every Monday{data.group ? ` for ${data.group}` : ""}.</p>
      </div>
      {data.maps.length === 0 && <div className="card"><p>The first concept map arrives on Monday. Turn on reminders so you don't miss it.</p></div>}
      {data.maps.map((m, i) => (
        <Link key={m.id} to={`/maps/${m.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", borderColor: i === 0 && data.latestIsNew ? "#3b2fc9" : undefined }}>
          <div>
            {i === 0 && data.latestIsNew && <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "#3b2fc9", padding: "3px 8px", borderRadius: 8 }}>THIS WEEK</span>}
            <p style={{ fontWeight: 800, fontSize: 16, marginTop: 4 }}>{m.title}</p>
            <p style={{ fontSize: 13, color: "var(--text2)" }}>{m.subject} · {fmtDay(m.publish_on)}</p>
          </div>
          <span style={{ fontWeight: 800, color: "var(--blue-mid)" }}>Open →</span>
        </Link>
      ))}
    </>
  );
}

function OneMap({ id }) {
  const { user } = useAuth();
  const [m, setM] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { api.get(`/weekly/maps/${id}`).then((r) => setM(r.data.map)).catch(() => setMissing(true)); }, [id]);
  if (missing) return shell(<><Link to="/maps">← All concept maps</Link><div className="card">This map isn't available.</div></>);
  if (!m) return shell(<div className="loading-screen"><div className="spinner"></div></div>);
  const practice = `/practice?subject=${encodeURIComponent(m.subject)}&chapter=${encodeURIComponent(m.chapter)}`;
  return shell(
    <>
      <Link to="/maps" style={{ fontSize: 14, color: "var(--blue-mid)", fontWeight: 600 }}>← All concept maps</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>{m.data.title}</h1>
      <MapView map={m.data} subject={m.subject} chapter={m.chapter} />
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {!isJuniorFree(user) && <Link className="btn btn-blue" style={{ justifyContent: "center", height: 48 }} to={practice}>Practise this chapter</Link>}
        <button className="btn btn-outline" style={{ justifyContent: "center", height: 48 }} onClick={() => drawMapPost(m.data, m.subject, m.chapter)}>Save as image</button>
      </div>
    </>
  );
}
