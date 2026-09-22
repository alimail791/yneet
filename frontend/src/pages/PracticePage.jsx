import { useState, useEffect } from "react";
import api from "../lib/api";

export default function PracticePage() {
  const [questions, setQuestions] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [filters, setFilters] = useState({ subject:"", chapter:"", isPYQ:"", isRepeated:"", page:1 });
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [stats, setStats] = useState({ totalSolved:0, totalCorrect:0, accuracy:0 });
  const [revealed, setRevealed] = useState({});
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("browse"); // "browse" | "recommended"
  const [weakChapters, setWeakChapters] = useState([]);
  const [recoMessage, setRecoMessage] = useState(null);

  const fetchRecommended = async () => {
    setLoading(true);
    setRecoMessage(null);
    try {
      const { data } = await api.get("/practice/recommended");
      setQuestions(data.questions || []);
      setWeakChapters(data.weakChapters || []);
      setTotal(data.questions?.length || 0);
      setPages(1);
      if (data.message) setRecoMessage(data.message);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const switchMode = (m) => {
    setMode(m);
    setFilters(f => ({ ...f, page: 1 }));
    if (m === "recommended") fetchRecommended();
    else fetchQuestions();
  };

  const fetchQuestions = async (f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.subject) params.set("subject", f.subject);
      if (f.chapter) params.set("chapter", f.chapter);
      if (f.isPYQ) params.set("isPYQ", f.isPYQ);
      if (f.isRepeated) params.set("isRepeated", f.isRepeated);
      params.set("page", f.page); params.set("limit", 20);
      const [qRes, sRes] = await Promise.all([
        api.get(`/practice/questions?${params}`),
        api.get("/practice/stats"),
      ]);
      setQuestions(qRes.data.questions||[]);
      setTotal(qRes.data.total||0);
      setPages(qRes.data.pages||1);
      setStats(sRes.data.stats||{totalSolved:0,totalCorrect:0,accuracy:0});
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const fetchChapters = async (subject) => {
    if (!subject) { setChapters([]); return; }
    const res = await api.get(`/practice/chapters?subject=${subject}`);
    setChapters(res.data.chapters||[]);
  };

  useEffect(() => { fetchQuestions(); }, []);

  const setFilter = (k, v) => {
    const newF = { ...filters, [k]: v, page: 1 };
    if (k === "subject") { newF.chapter = ""; fetchChapters(v); }
    setFilters(newF);
    fetchQuestions(newF);
  };

  const toggleReveal = (id) => setRevealed(r => ({ ...r, [id]: !r[id] }));

  const markSolved = async (q, correct) => {
    await api.post("/practice/solve", { questionId: q.id, correct });
    setQuestions(qs => qs.map(item => item.id===q.id ? { ...item, userStat: { solved:true, correct } } : item));
    setStats(s => ({
      ...s,
      totalSolved: s.totalSolved + (q.userStat ? 0 : 1),
      totalCorrect: s.totalCorrect + (correct ? 1 : 0),
      accuracy: Math.round(((s.totalCorrect+(correct?1:0)) / (s.totalSolved+(q.userStat?0:1)))*100),
    }));
  };

  return (
    <div>
      <div className="section-header mb-4">
        <div><div className="section-title">Practice Questions</div><p style={{fontSize:13,color:"var(--text2)"}}>PYQs · Repeated Questions · Subject-wise</p></div>
      </div>

      {/* Mode toggle */}
      <div className="chip-row mb-4" style={{ display: "flex", gap: 8 }}>
        <span onClick={() => switchMode("browse")} className="chip" style={{ cursor: "pointer", background: mode === "browse" ? "var(--blue-light)" : "var(--gray2)", color: mode === "browse" ? "var(--blue)" : "var(--text2)" }}>
          Browse All
        </span>
        <span onClick={() => switchMode("recommended")} className="chip" style={{ cursor: "pointer", background: mode === "recommended" ? "var(--purple-light)" : "var(--gray2)", color: mode === "recommended" ? "var(--purple)" : "var(--text2)" }}>
          🎯 Recommended for You
        </span>
      </div>

      {mode === "recommended" && weakChapters.length > 0 && (
        <div className="card mb-4" style={{ background: "var(--purple-light)" }}>
          <p style={{ fontSize: 13, color: "var(--text)" }}>
            <strong>Based on your mistakes, focusing on:</strong> {weakChapters.map(c => `${c.subject} · ${c.chapter}`).join("  ·  ")}
          </p>
        </div>
      )}

      {mode === "recommended" && recoMessage && (
        <div className="card text-center mb-4" style={{ padding: 30 }}>
          <p style={{ color: "var(--text2)" }}>{recoMessage}</p>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid3 mb-5">
        <div className="card"><div className="card-title">Problems Solved</div><div className="card-value" style={{color:"var(--blue)"}}>{stats.totalSolved}</div><div className="card-sub">total attempted</div></div>
        <div className="card"><div className="card-title">Correct</div><div className="card-value" style={{color:"var(--green)"}}>{stats.totalCorrect}</div><div className="card-sub">out of {stats.totalSolved}</div></div>
        <div className="card"><div className="card-title">Accuracy</div><div className="card-value" style={{color:"var(--purple)"}}>{stats.accuracy}%</div><div className="card-sub">keep it above 70%!</div></div>
      </div>

      {/* Filters */}
      {mode === "browse" && (
      <div className="card mb-5">
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:140}}>
            <label className="form-label">Subject</label>
            <select className="form-select" value={filters.subject} onChange={e=>setFilter("subject",e.target.value)}>
              <option value="">All Subjects</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
            </select>
          </div>
          {chapters.length>0 && (
            <div style={{flex:1,minWidth:160}}>
              <label className="form-label">Chapter</label>
              <select className="form-select" value={filters.chapter} onChange={e=>setFilter("chapter",e.target.value)}>
                <option value="">All Chapters</option>
                {chapters.map(c=><option key={c.chapter} value={c.chapter}>{c.chapter} ({c._count.id})</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Filter</label>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setFilter("isPYQ",filters.isPYQ?"":  "true")} className={`btn btn-sm ${filters.isPYQ?"btn-amber":"btn-outline"}`}>PYQ Only</button>
              <button onClick={()=>setFilter("isRepeated",filters.isRepeated?"":"true")} className={`btn btn-sm ${filters.isRepeated?"btn-red":"btn-outline"}`}>Repeated</button>
            </div>
          </div>
          <div style={{fontSize:13,color:"var(--text3)",alignSelf:"center"}}>{total} questions found</div>
        </div>
      </div>
      )}

      {/* Questions */}
      {mode === "recommended" && recoMessage ? null : loading ? (
        <div className="loading-screen" style={{minHeight:200}}><div className="spinner"></div></div>
      ) : questions.length === 0 ? (
        <div className="card text-center" style={{padding:40}}>
          <div style={{fontSize:40,marginBottom:12}}>📚</div>
          <h3>No questions found</h3>
          <p style={{color:"var(--text2)",marginTop:8}}>Try changing your filters or run <code>npm run db:seed</code> to add questions.</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {questions.map((q,i) => (
            <div key={q.id} className="card" style={{borderLeft:`3px solid ${q.subject==="Biology"?"var(--green)":q.subject==="Physics"?"var(--blue)":"var(--amber)"}`}}>
              {/* Header */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
                <span style={{fontSize:12,color:"var(--text3)",fontWeight:600}}>Q{(filters.page-1)*20+i+1}</span>
                <span className={`chip ${q.subject==="Biology"?"chip-green":q.subject==="Physics"?"chip-blue":"chip-amber"}`}>{q.subject}</span>
                <span style={{fontSize:12,color:"var(--text2)"}}>{q.chapter} · {q.topic}</span>
                {q.isPYQ && <span className="pyq-badge">PYQ {q.pyqYear}</span>}
                {q.isRepeated && <span className="repeat-badge">Repeated</span>}
                {q.userStat?.solved && <span className="solved-badge">{q.userStat.correct?"✓ Correct":"✗ Wrong"}</span>}
                <span style={{marginLeft:"auto",fontSize:11,color:q.difficulty==="hard"?"var(--red)":q.difficulty==="easy"?"var(--green)":"var(--amber)",fontWeight:600,textTransform:"uppercase"}}>{q.difficulty}</span>
              </div>

              {/* Question */}
              <p style={{fontSize:15,fontWeight:500,lineHeight:1.6,marginBottom:12}}>{q.questionText}</p>

              {/* Options */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                {["A","B","C","D"].map((key,idx)=>(
                  <div key={key} style={{display:"flex",gap:8,padding:"8px 12px",background:revealed[q.id]&&idx===q.correctOpt?"var(--green-light)":"var(--gray2)",border:`1.5px solid ${revealed[q.id]&&idx===q.correctOpt?"var(--green)":"var(--gray3)"}`,borderRadius:8,fontSize:13,color:revealed[q.id]&&idx===q.correctOpt?"var(--green)":"var(--text)"}}>
                    <span style={{fontWeight:700,minWidth:18}}>{key})</span>
                    <span>{[q.optionA,q.optionB,q.optionC,q.optionD][idx]}</span>
                  </div>
                ))}
              </div>

              {/* Show Answer */}
              {!revealed[q.id] ? (
                <button className="btn btn-outline btn-sm" onClick={()=>toggleReveal(q.id)}>👁 Show Answer</button>
              ) : (
                <div style={{background:"var(--green-light)",borderLeft:"3px solid var(--green)",padding:"10px 14px",borderRadius:"0 8px 8px 0",fontSize:13,lineHeight:1.7,marginBottom:10}}>
                  <strong style={{color:"var(--green)"}}>✅ Answer: {["A","B","C","D"][q.correctOpt]}) {[q.optionA,q.optionB,q.optionC,q.optionD][q.correctOpt]}</strong>
                  <br/>{q.explanation}
                </div>
              )}

              {/* Mark solved */}
              {!q.userStat?.solved && (
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="btn btn-green btn-sm" onClick={()=>markSolved(q,true)}>✓ Got it right</button>
                  <button className="btn btn-red btn-sm" onClick={()=>markSolved(q,false)}>✗ Got it wrong</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {mode === "browse" && pages > 1 && (
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:24}}>
          <button className="btn btn-outline btn-sm" disabled={filters.page<=1} onClick={()=>setFilter("page",filters.page-1)}>← Prev</button>
          <span style={{padding:"6px 14px",fontSize:13,color:"var(--text2)"}}>Page {filters.page} of {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={filters.page>=pages} onClick={()=>setFilter("page",filters.page+1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
