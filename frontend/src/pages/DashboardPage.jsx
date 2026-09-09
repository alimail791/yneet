import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from "chart.js";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import useCountdown from "../hooks/useCountdown";
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const MOTIVATIONS = [
  "Success is the sum of small efforts, repeated day in and day out.",
  "Don't watch the clock — do what it does. Keep going.",
  "Every expert was once a beginner. Stay consistent.",
  "Your NEET rank is determined by your habits, not your luck.",
  "Small daily improvements are the key to staggering long-term results.",
  "Believe you can and you're halfway there.",
  "The secret of getting ahead is getting started.",
];
const LEVEL_NAMES = ["","Beginner","Explorer","Learner","Achiever","Scholar","Expert","Champion","Master","Elite","Legend"];
const XP_LEVELS = [0,100,300,600,1000,1500,2200,3000,4000,5500,7500];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const examDate = user?.profile?.neetDate || user?.neetDate || "2026-05-03";
  const countdown = useCountdown(examDate);
  const p = user?.profile || {};

  useEffect(() => {
    api.get("/dashboard").then(r => { setStats(r.data.stats); setHistory(r.data.scoreHistory||[]); })
      .catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const xpLevel = user?.xp?.level || 1;
  const xpTotal = user?.xp?.total || 0;
  const xpNext = XP_LEVELS[xpLevel] || 100;
  const streak = user?.streak?.current || 0;
  const targetScore = p.targetScore || 650;
  const currentScore = p.currentScore || stats?.latestScore || 0;

  const chartData = {
    labels: history.map((_,i)=>`Mock ${i+1}`),
    datasets: [
      { label:"Score", data:history.map(h=>h.score), borderColor:"#2563eb", backgroundColor:"rgba(37,99,235,.08)", fill:true, tension:.4, pointRadius:4 },
      { label:"Target", data:history.map(()=>targetScore), borderColor:"#7c3aed", borderWidth:1.5, borderDash:[6,4], fill:false, pointRadius:0 },
    ],
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  const motiv = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length];
  const rankEst = s => s>=680?"AIR ~500":s>=650?"AIR ~2,000":s>=600?"AIR ~8,000":s>=550?"AIR ~20,000":s>=500?"AIR ~45,000":"AIR ~90,000+";

  return (
    <div>
      {/* Motivation */}
      <div className="motiv-card">
        <div className="motiv-quote">"{motiv}"</div>
        <div style={{fontSize:13,opacity:.8}}>Good morning, {user?.name?.split(" ")[0]}! <strong>{countdown.days}</strong> days left for NEET.</div>
      </div>

      {/* Countdown */}
      <div className="countdown-bar mb-5">
        <div>
          <div style={{fontSize:11,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>NEET Countdown</div>
          <div className="countdown-main">{countdown.days} Days Left</div>
          <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>Exam: {new Date(examDate).toDateString()}</div>
        </div>
        <div className="countdown-units">
          {[["Days",countdown.days],["Hours",String(countdown.hours).padStart(2,"0")],["Mins",String(countdown.mins).padStart(2,"0")],["Secs",String(countdown.secs).padStart(2,"0")]].map(([l,v])=>(
            <div key={l} className="c-unit"><span className="c-unit-num">{v}</span><span className="c-unit-lbl">{l}</span></div>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid3 mb-5">
        <div className="card"><div className="card-title">Current Score</div><div className="card-value" style={{color:"var(--blue)"}}>{currentScore}</div><div className="card-sub">out of 720</div></div>
        <div className="card"><div className="card-title">Target Score</div><div className="card-value" style={{color:"var(--purple)"}}>{targetScore}</div><div className="card-sub">{targetScore-currentScore} marks to go</div></div>
        <div className="card"><div className="card-title">Study Streak</div><div className="card-value" style={{color:"var(--amber)"}}>{streak} 🔥</div><div className="card-sub">Best: {user?.streak?.longest||0} days</div></div>
      </div>

      {/* Subject-wise Progress + Estimated Rank */}
      <div className="grid2 mb-5">
        <div className="card">
          <div className="section-title mb-4">Subject-wise Progress</div>
          <p style={{fontSize:13,color:"var(--text2)",marginBottom:12}}>Accuracy across your mock tests so far</p>
          {[["Physics",stats?.subjects?.physics||0,"amber"],["Chemistry",stats?.subjects?.chemistry||0,"green"],["Biology",stats?.subjects?.biology||0,"blue"]].map(([s,v,c])=>(
            <div key={s} style={{marginBottom:10}}>
              <div className="subj-row"><span>{s}</span><span style={{color:`var(--${c})`}}>{v}%</span></div>
              <div className="prog-bar"><div className={`prog-fill prog-${c}`} style={{width:`${v}%`}}></div></div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="section-title mb-4">Estimated AIR (based on your scores)</div>
          {stats?.totalAttempts > 0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              {[["Latest Mock",rankEst(stats?.latestScore||0),"blue"],["Best Mock",rankEst(stats?.bestScore||0),"green"]].map(([l,v,c])=>(
                <div key={l} style={{background:`var(--${c}-light)`,borderRadius:10,padding:"10px 14px"}}>
                  <div style={{fontSize:11,color:`var(--${c})`,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                  <div style={{fontSize:20,fontWeight:800,color:`var(--${c})`}}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{background:"var(--gray2)",borderRadius:10,padding:"18px 14px",textAlign:"center"}}>
              <p style={{fontSize:13,color:"var(--text3)"}}>Take your first mock test to see your estimated AIR here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid4 mb-5">
        <div className="card"><div className="card-title">Mocks Taken</div><div className="card-value" style={{color:"var(--blue)"}}>{stats?.totalAttempts||0}</div><div className="card-sub">Best: {stats?.bestScore||0}</div></div>
        <div className="card"><div className="card-title">Practice Solved</div><div className="card-value" style={{color:"var(--green)"}}>{stats?.practiceCount||0}</div><div className="card-sub" style={{cursor:"pointer",color:"var(--blue)"}} onClick={()=>navigate("/practice")}>Go practice →</div></div>
        <div className="card"><div className="card-title">Total Mistakes</div><div className="card-value" style={{color:"var(--red)"}}>{stats?.mistakes?.total||0}</div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>
            Mock: {stats?.mistakes?.mock||0} · Quiz: {stats?.mistakes?.quiz||0} · Practice: {stats?.mistakes?.practice||0}
          </div>
        </div>
        <div className="card"><div className="card-title">Avg Accuracy</div><div className="card-value" style={{color:"var(--purple)"}}>{stats?.avgAccuracy||0}%</div><div className="card-sub">across all mocks</div></div>
      </div>

      {/* Quick Actions */}
      <div className="grid3 mb-5">
        {[{icon:"📝",label:"Mock Tests",sub:"30 full-length tests",path:"/mock",color:"blue"},{icon:"⚡",label:"Daily Quiz",sub:"50 Qs · Bio+Phy+Chem",path:"/quiz",color:"purple"},{icon:"📖",label:"Practice",sub:"PYQs + repeated Qs",path:"/practice",color:"green"},{icon:"🧬",label:"Biology Hub",sub:"Flashcards · NCERT",path:"/biology",color:"blue"},{icon:"⚛️",label:"Physics Hub",sub:"Formulas · concepts",path:"/physics",color:"amber"},{icon:"🧪",label:"Chemistry Hub",sub:"Equations · reactions",path:"/chemistry",color:"red"}].map(a=>(
          <button key={a.path} onClick={()=>navigate(a.path)} className={`btn btn-${a.color}`} style={{padding:18,flexDirection:"column",gap:6,height:"auto",borderRadius:"var(--r)",textAlign:"center"}}>
            <span style={{fontSize:26}}>{a.icon}</span>
            <span style={{fontWeight:700,fontSize:14}}>{a.label}</span>
            <span style={{fontSize:12,opacity:.85}}>{a.sub}</span>
          </button>
        ))}
      </div>

      {/* Score Chart */}
      {history.length > 0 && (
        <div className="card mb-5">
          <div className="section-header"><div className="section-title">Score Progress</div><span className="chip chip-green">+{Math.max(0,(history.at(-1)?.score||0)-(history[0]?.score||0))} pts</span></div>
          <div style={{height:200}}><Line data={chartData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:720,grid:{color:"rgba(0,0,0,.04)"}},x:{grid:{display:false}}}}}/></div>
        </div>
      )}

      {/* XP */}
      <div className="card mb-5">
        <div className="section-header"><div className="section-title">Level & XP</div><span className="chip chip-purple">Lv.{xpLevel} {LEVEL_NAMES[xpLevel]||"Legend"}</span></div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{fontSize:36,fontWeight:800,color:"var(--purple)"}}>{xpLevel}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--text2)",marginBottom:5}}><span>{LEVEL_NAMES[xpLevel]}</span><span>{xpTotal.toLocaleString()} / {xpNext.toLocaleString()} XP</span></div>
            <div className="xp-bar-wrap"><div className="xp-bar" style={{width:`${Math.min(100,Math.round(xpTotal/xpNext*100))}%`}}></div></div>
            <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>{Math.max(0,xpNext-xpTotal).toLocaleString()} XP to next level</div>
          </div>
        </div>
      </div>

      {/* Mistakes summary */}
      <div className="card">
        <div className="section-header"><div className="section-title">Mistake Notebook</div><button className="btn btn-outline btn-sm" onClick={()=>navigate("/mistakes")}>View All →</button></div>
        <div className="grid3">
          {[["Mock Mistakes",stats?.mistakes?.mock||0,"red","/mistakes?source=mock"],["Quiz Mistakes",stats?.mistakes?.quiz||0,"amber","/mistakes?source=quiz"],["Practice Mistakes",stats?.mistakes?.practice||0,"purple","/mistakes?source=practice"]].map(([l,v,c,path])=>(
            <div key={l} onClick={()=>navigate(path)} className="card" style={{cursor:"pointer",border:`1.5px solid var(--${c}-light)`}}>
              <div className="card-title">{l}</div>
              <div className="card-value" style={{color:`var(--${c})`}}>{v}</div>
              <div className="card-sub">questions to review</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
