/* YNeet Daily front end. Talks to the API on the same origin. */
(function () {
'use strict';
const GAMES = [
  { id: 'bioword', name: 'BioWord', color: 'var(--g1)', icon: 'B', sub: 'Guess the 5-letter biology term' },
  { id: 'pinpoint', name: 'Pinpoint NEET', color: 'var(--g2)', icon: 'P', sub: 'Find the NCERT chapter from clues' },
  { id: 'zip', name: 'Pathway Zip', color: 'var(--g3)', icon: 'Z', sub: 'Connect the steps in order' },
  { id: 'queens', name: 'Element Queens', color: 'var(--g4)', icon: 'Q', sub: 'One atom per row, column and block' },
  { id: 'daily5', name: 'Daily 5', color: 'var(--g5)', icon: '5', sub: '5 NEET MCQs in 2 minutes' }
];
// Class tracks: each has its own puzzles and leaderboard (see lib/games.js on the server).
const CLASSES = ['6', '7', '8', '9', '10', '11', '12', 'Dropper'];
const trackForClass = c => (['6', '7', '8'].includes(c) ? 'junior' : ['9', '10'].includes(c) ? 'foundation' : 'neet');
const TRACK = {
  junior: { label: 'Class 6–8', short: 'Junior', kind: 'science', names: { bioword: 'Science Word', pinpoint: 'Pinpoint' },
    subs: { bioword: 'Guess the science word', daily5: '5 science MCQs in 2 minutes', queens: 'One planet per row, column and block' } },
  foundation: { label: 'Class 9–10', short: 'Foundation', kind: 'science', names: { bioword: 'Science Word', pinpoint: 'Pinpoint' },
    subs: { bioword: 'Guess the science word', daily5: '5 science MCQs in 2 minutes' } },
  neet: { label: 'Class 11–12 & Droppers', short: 'NEET', kind: 'NEET', names: {}, subs: {} },
};
let cls = null; // chosen class; the track follows from it
const track = () => trackForClass(cls || '12');
const T = () => TRACK[track()];
const gname = g => T().names[g.id] || g.name;
const gsub = g => T().subs[g.id] || g.sub;
const rankLabel = () => (track() === 'neet' ? 'All-India' : T().label);
const REG_COLORS = { A: 'var(--r1)', B: 'var(--r2)', C: 'var(--r3)', D: 'var(--r4)', E: 'var(--r5)', F: 'var(--r6)', G: 'var(--r7)', H: 'var(--r8)' };

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

// first-touch referral: ?r=CODE&s=status
(function () {
  const u = new URLSearchParams(location.search);
  const r = (u.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const s = (u.get('s') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
  if ((r || s) && !ls.get('yd-ref')) ls.set('yd-ref', { r, s: s || 'share' });
  if (u.get('r') || u.get('s')) history.replaceState(null, '', location.pathname);
})();

let token = ls.get('yd-token', null);
let me = null, P = null, day = null;
const app = document.getElementById('app'), sheetRoot = document.getElementById('sheetRoot');
const $ = h => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const playUrl = () => location.origin + '/play';
let tick = null;
const stopTick = () => { if (tick) { clearInterval(tick); tick = null; } };

async function api(path, body) {
  const opt = { headers: { 'Content-Type': 'application/json' } };
  if (token) opt.headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) { opt.method = 'POST'; opt.body = JSON.stringify(body); }
  const r = await fetch(path, opt);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { token = null; me = null; ls.del('yd-token'); }
  if (!r.ok) throw new Error(j.error || 'Network problem. Check your internet and try again.');
  return j;
}
// NEET keeps the original key so existing players keep today's progress.
const dayKey = () => 'yd-day-' + (track() === 'neet' ? '' : track() + '-') + P.date;
const saveDay = () => ls.set(dayKey(), day);
const dateLabel = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const resultOf = id => (me && me.today && me.today[id]) || (day.done[id] && (day.done[id].server || day.done[id].preview));

/* ---------- HOME ---------- */
function home() {
  stopTick(); sheetRoot.innerHTML = '';
  const n = GAMES.filter(g => resultOf(g.id)).length;
  app.innerHTML = '';
  app.append($(`<div class="top"><div><div class="eyebrow">Raise Academy presents</div><div class="brand"><h1>YNeet <span>Daily</span></h1></div></div><div class="streak">🔥 ${me ? me.streak : 0} day</div></div>`));
  app.append(refPanel());
  const chip = $(`<div class="classchip"><span>Playing as <b>${esc(T().label)}</b>${cls && cls !== 'Dropper' ? ` · Class ${esc(cls)}` : cls === 'Dropper' ? ' · Dropper' : ''}</span><button class="ghost" type="button">Change class</button></div>`);
  chip.querySelector('button').onclick = () => classPicker(true);
  app.append(chip);
  app.append($(`<div class="eyebrow">#${P.no} · ${dateLabel(P.date)} · ${n}/5 solved</div>`));
  const list = $(`<div class="list"></div>`);
  GAMES.forEach(g => {
    const d = resultOf(g.id);
    const c = $(`<div class="gamecard"><div class="gicon" style="background:${g.color}">${g.icon}</div>
      <div class="ginfo"><h2>${gname(g)}<small>#${P.no}</small></h2><p>${d ? 'Done · ' + esc(d.line) : (g.id === 'bioword' ? `Guess the ${P.bioword.length}-letter ${track() === 'neet' ? 'biology term' : 'science word'}` : gsub(g))}</p></div>
      <button class="solve ${d ? 'done' : ''}" style="background:${g.color}">${d ? 'Share' : 'Solve'}</button></div>`);
    c.querySelector('button').onclick = () => d ? openSheet(g.id) : openGame(g.id);
    list.append(c);
  });
  app.append(list);
  app.append(yneetPanel(null, null));
  const lb = $(`<button class="primary lbbtn">🏆 ${track() === 'neet' ? 'Leaderboard · your All-India rank' : esc(T().label) + ' leaderboard · your rank'}</button>`);
  lb.onclick = leaderboard; app.insertBefore(lb, list);
  const st = $(`<button class="ghost" style="align-self:center">📲 Make today's WhatsApp Status card</button>`);
  st.onclick = statusCard; app.append(st);
  if (me) { const lo = $(`<button class="ghost" style="align-self:center;font-size:13px">Not ${esc(me.name.split(' ')[0])}? Log out</button>`); lo.onclick = () => { token = null; me = null; ls.del('yd-token'); home(); }; app.append(lo); }
}
function rewardBox() {
  return me.rewardApplied
    ? `<div class="unlock">🎉 Your free YNeet month has been added to your account. Log in at <b>www.yneet.in</b> with this WhatsApp number.</div>`
    : `<div class="unlock">🎉 Unlocked! 1 month of YNeet free (code <code>${esc(me.rewardCode)}</code>). Sign up or log in at <b>www.yneet.in</b> with this same WhatsApp number and the month is added automatically.</div>`;
}

/* ---------- YNeet panel: the step from free games to YNeet ---------- */
const YNEET_SITE = 'https://www.yneet.in';
function yneetLink(path, campaign) {
  const u = new URLSearchParams({ utm_source: 'yneet_daily', utm_medium: 'game', utm_campaign: campaign || 'home' });
  if (path === '/register' && me) { u.set('name', me.name); if (me.phone) u.set('phone', me.phone); }
  return `${YNEET_SITE}${path}?${u}`;
}
function track_(kind, detail) {
  try { fetch('/api/track', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ kind, detail }) }); } catch (e) {}
}
function yneetPanel(gameId, d) {
  const SUBJ = { Bio: 'Biology', Chem: 'Chemistry', Phy: 'Physics' };
  if (track() === 'junior') {
    const p = $(`<div class="panel yneet">
      <div class="eyebrow">YNeet · free for Class 6–8</div>
      <strong class="yn-title">Daily quiz and Shorts — free on YNeet</strong>
      <p class="how" style="margin:0">Class tests, a daily quiz from your syllabus and 3-minute concept videos. No payment, ever. Parents get a weekly report on WhatsApp.</p>
      <a class="primary" target="_blank" rel="noopener">Register free</a>
      <a class="yn-login" target="_blank" rel="noopener">Already on YNeet? Log in</a>
    </div>`);
    const [go, login] = p.querySelectorAll('a');
    go.href = yneetLink('/register', gameId).replace('/register?', '/register?junior=1&'); login.href = yneetLink('/login', gameId);
    go.onclick = () => track_('yneet_signup', 'junior_' + (gameId || 'home'));
    login.onclick = () => track_('yneet_login', 'junior_' + (gameId || 'home'));
    return p;
  }
  let title = track() === 'foundation' ? 'NEET Foundation for Class 9–10' : 'Prepare for NEET on YNeet',
    text = track() === 'foundation' ? 'Foundation tests, concept Shorts and a daily quiz for Class 9–10, so NEET in Class 11 feels easy. 30 days free.' : 'Full NEET mock tests, chapter-wise practice and PYQs with instant analysis of your weak areas.';
  if (track() === 'foundation') { if (gameId) title = 'Turn your daily streak into marks'; }
  else if (gameId === 'pinpoint' && d && d.topic) { title = `Revise “${d.topic}”`; text = 'Practise this chapter with NEET-level questions and PYQs on YNeet, with explanations for every answer.'; }
  else if (gameId === 'daily5' && d && d.weak && d.weak.length) { title = `Missed ${d.weak.map(s => SUBJ[s] || s).join(' and ')} today?`; text = 'Practise those chapters on YNeet with full mock tests, PYQs and instant analysis of your weak areas.'; }
  else if (gameId === 'daily5' && d && d.line === '5/5') { title = 'Perfect score! Try a full NEET mock'; text = 'Test yourself on a full 720-mark NEET mock test on YNeet, with All-India analysis.'; }
  else if (gameId) { title = 'Turn your daily streak into marks'; }
  const p = $(`<div class="panel yneet">
    <div class="eyebrow">YNeet · NEET preparation</div>
    <strong class="yn-title"></strong>
    <p class="how" style="margin:0"></p>
    <a class="primary" target="_blank" rel="noopener">Start free 30-day trial</a>
    <a class="yn-login" target="_blank" rel="noopener">Already on YNeet? Log in</a>
  </div>`);
  if (track() === 'neet') {
    // Free next step for players not ready to register: the 15-question readiness test.
    const rd = document.createElement('a');
    rd.className = 'yn-login'; rd.target = '_blank'; rd.rel = 'noopener';
    rd.href = yneetLink('/neet-readiness', gameId);
    rd.textContent = '📊 Check your NEET Readiness Score (free, 5 min)';
    rd.onclick = () => track_('yneet_readiness', gameId || 'home');
    p.appendChild(rd);
  }
  p.querySelector('.yn-title').textContent = title;
  p.querySelector('.how').textContent = text;
  const [go, login] = p.querySelectorAll('a');
  go.href = yneetLink('/register', gameId); login.href = yneetLink('/login', gameId);
  go.onclick = () => track_('yneet_signup', (track() === 'neet' ? '' : track() + '_') + (gameId || 'home'));
  login.onclick = () => track_('yneet_login', (track() === 'neet' ? '' : track() + '_') + (gameId || 'home'));
  return p;
}

function refPanel() {
  const need = me ? me.needed : 3, r = me ? Math.min(me.referrals, need) : 0;
  const p = $(`<div class="panel ref" style="display:flex;flex-direction:column;gap:10px"></div>`);
  p.append($(`<h3>Invite ${need} friends → 1 month YNeet free</h3>`));
  p.append($(`<div><div class="bar"><i style="width:${r / need * 100}%"></i></div><div class="reftext"><span>${r}/${need} friends registered</span><span>${me ? 'Your code: <b>' + me.code + '</b>' : 'Play a game to get your link'}</span></div></div>`));
  if (me && me.rewardCode) p.append($(rewardBox()));
  return p;
}

/* ---------- GAME SHELL ---------- */
function openGame(id) {
  stopTick();
  const g = GAMES.find(x => x.id === id);
  app.innerHTML = '';
  const head = $(`<div class="stagehead"><button class="back">← Games</button><h2>${gname(g)} <small class="eyebrow">#${P.no}</small></h2><span class="timer" id="tm"></span></div>`);
  head.querySelector('.back').onclick = home;
  app.append(head);
  const stage = $(`<div style="display:flex;flex-direction:column;gap:14px"></div>`);
  app.append(stage);
  ({ bioword, pinpoint, zip, queens, daily5 })[id](stage);
  window.scrollTo(0, 0);
}
function startClock() {
  const t0 = Date.now(), el = document.getElementById('tm');
  tick = setInterval(() => { el.textContent = fmt(Math.floor((Date.now() - t0) / 1000)); }, 500);
  return () => Math.max(1, Math.floor((Date.now() - t0) / 1000));
}
async function finish(id, attempt, preview) {
  stopTick();
  if (!day.done[id]) { day.done[id] = { attempt, preview, submitted: false }; saveDay(); }
  await new Promise(r => setTimeout(r, 800));
  if (token) { try { await submit(id); } catch (e) { console.warn(e); } }
  openSheet(id);
}
async function submit(id) {
  const d = day.done[id];
  if (!d || d.submitted) return;
  const j = await api('/api/results', { date: P.date, game: id, attempt: d.attempt, track: track() });
  d.submitted = true; d.server = j.result; d.rank = j.rank; me = j.me; saveDay();
}
async function submitAll() { for (const g of GAMES) { try { await submit(g.id); } catch (e) { console.warn(g.id, e.message); } } }

/* ---------- BIOWORD ---------- */
function bioword(st) {
  const L = P.bioword.length;
  st.append($(`<p class="how">${L} letters. Hint: ${esc(P.bioword.hint)}. 6 tries. 🟩 right place · 🟨 wrong place.</p>`));
  const grid = $(`<div class="wgrid ${L >= 7 ? 'long' : ''}" style="width:min(100%, ${L * 60}px)"></div>`);
  for (let r = 0; r < 6; r++) { const row = $(`<div class="wrow" style="grid-template-columns:repeat(${L},1fr)"></div>`); for (let c = 0; c < L; c++) row.append($(`<div class="tile"></div>`)); grid.append(row); }
  const toast = $(`<div class="toast"></div>`);
  st.append(grid, toast);
  const kb = $(`<div class="kb"></div>`), keys = {};
  ['QWERTYUIOP', 'ASDFGHJKL', '>ZXCVBNM<'].forEach(r => {
    const row = $(`<div class="kr"></div>`);
    [...r].forEach(k => {
      const lab = k === '>' ? 'ENTER' : k === '<' ? '⌫' : k;
      const b = $(`<button class="key ${k === '>' || k === '<' ? 'wide' : ''}">${lab}</button>`);
      b.onclick = () => press(k === '>' ? 'Enter' : k === '<' ? 'Backspace' : k);
      keys[k] = b; row.append(b);
    });
    kb.append(row);
  });
  st.append(kb);
  let row = 0, cur = '', busy = false, over = false;
  const guesses = [], emos = [];
  const paint = () => { const t = grid.children[row].children; for (let i = 0; i < L; i++) { t[i].textContent = cur[i] || ''; t[i].classList.toggle('filled', !!cur[i]); } };
  const elapsed = startClock();
  async function press(k) {
    if (over || busy) return;
    if (k === 'Enter') {
      if (cur.length < L) { toast.textContent = `Need ${L} letters`; return; }
      busy = true; toast.textContent = '';
      let j;
      try { j = await api('/api/check/bioword', { date: P.date, guess: cur, attempt: row + 1, track: track() }); }
      catch (e) { toast.textContent = e.message; busy = false; return; }
      busy = false;
      const t = grid.children[row].children, rank = { a: 1, p: 2, c: 3 };
      j.res.forEach((r, i) => {
        t[i].classList.add(r);
        const kk = keys[cur[i]]; const old = kk.dataset.s || '';
        if (!old || rank[r] > rank[old]) { kk.classList.remove('a', 'p', 'c'); kk.classList.add(r); kk.dataset.s = r; }
      });
      guesses.push(cur); emos.push(j.res.map(r => ({ c: '🟩', p: '🟨', a: '⬜' })[r]).join(''));
      if (j.solved || row === 5) {
        over = true;
        toast.innerHTML = j.solved ? 'Brilliant!' : `The word was <b>${esc(j.answer)}</b>`;
        if (j.fact) st.insertBefore($(`<div class="fact">💡 ${esc(j.fact)}</div>`), kb);
        finish('bioword', { guesses, seconds: elapsed() }, { line: j.solved ? `${row + 1}/6` : 'X/6', emoji: emos.join('\n') });
        return;
      }
      row++; cur = '';
      return;
    }
    if (k === 'Backspace') { cur = cur.slice(0, -1); paint(); return; }
    if (/^[A-Z]$/.test(k) && cur.length < L) { cur += k; paint(); }
  }
  const onKey = e => {
    if (!document.body.contains(grid)) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'Enter' || e.key === 'Backspace') press(e.key); else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
  };
  document.addEventListener('keydown', onKey);
}

/* ---------- PINPOINT ---------- */
function pinpoint(st) {
  const T = P.pinpoint.totalClues;
  const SUBJ = { Bio: 'Biology', Chem: 'Chemistry', Phy: 'Physics' }[P.pinpoint.subject] || 'Biology';
  st.append($(`<p class="how">Today's subject: <b>${SUBJ}</b>. Which NCERT chapter links these clues? A wrong guess reveals the next clue. ${T} guesses.</p>`));
  const cl = $(`<div class="clues"></div>`);
  for (let i = 0; i < T; i++) cl.append($(`<div class="clue ${i === 0 ? 'on' : ''}"><b>${i + 1}</b>${i === 0 ? esc(P.pinpoint.firstClue) : 'Locked'}</div>`));
  const op = $(`<div class="opts"></div>`), toast = $(`<div class="toast"></div>`);
  st.append(cl, op, toast);
  const guesses = [], marks = []; let shown = 1, over = false, busy = false;
  const elapsed = startClock();
  P.pinpoint.options.forEach(o => {
    const b = $(`<button class="opt">${esc(o)}</button>`); op.append(b);
    b.onclick = async () => {
      if (over || busy || b.disabled) return;
      busy = true; toast.textContent = '';
      let j;
      try { j = await api('/api/check/pinpoint', { date: P.date, option: o, guessNo: guesses.length + 1, track: track() }); }
      catch (e) { toast.textContent = e.message; busy = false; return; }
      busy = false; guesses.push(o);
      if (j.correct) { b.classList.add('right'); marks.push('✅'); }
      else {
        b.classList.add('wrong'); b.disabled = true; marks.push('❌');
        if (j.nextClue) { cl.children[shown].classList.add('on'); cl.children[shown].innerHTML = `<b>${shown + 1}</b>${esc(j.nextClue)}`; shown++; }
      }
      if (j.answer) {
        over = true;
        if (j.clues) j.clues.forEach((c, i) => { cl.children[i].classList.add('on'); cl.children[i].innerHTML = `<b>${i + 1}</b>${esc(c)}`; });
        const rb = [...op.children].find(x => x.textContent === j.answer); if (rb) rb.classList.add('right');
        finish('pinpoint', { guesses, seconds: elapsed() }, { line: j.correct ? `${guesses.length}/${T}` : `X/${T}`, emoji: marks.join(''), topic: j.answer });
      }
    };
  });
}

/* ---------- PATHWAY ZIP ---------- */
function zip(st) {
  const Z = P.zip, N = Z.size, NODES = {}; Object.entries(Z.nodes).forEach(([k, v]) => NODES[+k] = v);
  const LAST = Math.max(...Object.values(NODES));
  st.append($(`<p class="how"><b>${esc(Z.title)}.</b> Drag from 1 through every number in order and fill every cell. Tap a cell on your path to undo back to it.</p>`));
  const wrap = $(`<div class="zipwrap"><div class="zipgrid" style="grid-template-columns:repeat(${N},1fr)"></div><svg class="zipsvg" viewBox="0 0 ${N} ${N}" preserveAspectRatio="none"><polyline fill="none" stroke="var(--g3)" stroke-width=".32" stroke-linecap="round" stroke-linejoin="round" points=""/></svg></div>`);
  const gridEl = wrap.querySelector('.zipgrid'), pl = wrap.querySelector('polyline');
  for (let i = 0; i < N * N; i++) gridEl.append($(`<div class="zc" data-i="${i}">${NODES[i] ? `<div class="node">${NODES[i]}</div>` : ''}</div>`));
  const lg = $(`<div class="legend"></div>`); Z.labels.forEach((l, i) => lg.append($(`<span><b>${i + 1}</b>${esc(l)}</span>`)));
  const btns = $(`<div class="zbtns"><button class="ghost">Undo</button><button class="ghost">Clear</button></div>`);
  st.append(wrap, lg, btns);
  const elapsed = startClock();
  let path = [], drag = false, over = false;
  const adj = (a, b) => Math.abs(a % N - b % N) + Math.abs(Math.floor(a / N) - Math.floor(b / N)) === 1;
  const nextNum = () => path.filter(i => NODES[i]).length + 1;
  function draw() {
    [...gridEl.children].forEach((c, i) => c.classList.toggle('in', path.includes(i)));
    pl.setAttribute('points', path.map(i => `${i % N + .5},${Math.floor(i / N) + .5}`).join(' '));
    if (path.length === N * N && NODES[path[path.length - 1]] === LAST && !over) {
      over = true; const s = elapsed();
      finish('zip', { path: path.slice(), seconds: s }, { line: `⏱ ${fmt(s)}`, emoji: `🧬 ${Z.title}: connected` });
    }
  }
  function tryAdd(i) {
    if (over || path.includes(i)) return;
    const last = path[path.length - 1];
    if (NODES[last] === LAST || !adj(last, i)) return;
    if (NODES[i] && NODES[i] !== nextNum()) return;
    path.push(i); draw();
  }
  const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); const c = el && el.closest && el.closest('.zc'); return c && gridEl.contains(c) ? +c.dataset.i : null; };
  wrap.addEventListener('pointerdown', e => {
    const i = cellAt(e.clientX, e.clientY); if (i == null || over) return;
    if (!path.length) { if (NODES[i] === 1) { path = [i]; draw(); drag = true; } }
    else if (path.includes(i)) { path = path.slice(0, path.indexOf(i) + 1); draw(); drag = true; }
    else { tryAdd(i); drag = true; }
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', e => {
    if (!drag) return; const i = cellAt(e.clientX, e.clientY); if (i == null) return;
    if (path.length > 1 && i === path[path.length - 2]) { path.pop(); draw(); } else tryAdd(i);
  });
  window.addEventListener('pointerup', () => { drag = false; });
  btns.children[0].onclick = () => { if (!over) { path.pop(); draw(); } };
  btns.children[1].onclick = () => { if (!over) { path = []; draw(); } };
}

/* ---------- ELEMENT QUEENS ---------- */
function queens(st) {
  const Q = P.queens, N = Q.size, R = Q.regions;
  st.append($(`<p class="how">Place one ⚛ atom in every row, every column and every coloured block. Atoms can't touch, not even diagonally. Tap once for ×, twice for ⚛.</p>`));
  const g = $(`<div class="qgrid" style="grid-template-columns:repeat(${N},1fr)"></div>`), cells = [], state = Array(N * N).fill(0);
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N), c = i % N;
    const b = $(`<button class="qc" aria-label="Row ${r + 1} column ${c + 1}" style="background:${REG_COLORS[R[r][c]]}"></button>`);
    b.onclick = () => { if (over) return; state[i] = (state[i] + 1) % 3; check(); };
    cells.push(b); g.append(b);
  }
  const lg = $(`<div class="qlegend"></div>`); Object.keys(Q.names).forEach(k => lg.append($(`<span style="background:${REG_COLORS[k]}">${esc(Q.names[k])}</span>`)));
  const clr = $(`<div class="zbtns"><button class="ghost">Clear board</button></div>`);
  st.append(g, lg, clr);
  const elapsed = startClock(); let over = false;
  clr.querySelector('button').onclick = () => { if (!over) { state.fill(0); check(); } };
  function check() {
    const atoms = []; state.forEach((s, i) => { if (s === 2) atoms.push(i); });
    const bad = new Set();
    for (let a = 0; a < atoms.length; a++) for (let b = a + 1; b < atoms.length; b++) {
      const i = atoms[a], j = atoms[b], ri = Math.floor(i / N), ci = i % N, rj = Math.floor(j / N), cj = j % N;
      if (ri === rj || ci === cj || R[ri][ci] === R[rj][cj] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) { bad.add(i); bad.add(j); }
    }
    cells.forEach((c, i) => { c.classList.toggle('x', state[i] === 1); c.classList.toggle('atom', state[i] === 2); c.classList.toggle('bad', bad.has(i)); });
    if (atoms.length === N && bad.size === 0) {
      over = true; const s = elapsed();
      finish('queens', { cells: atoms.map(i => [Math.floor(i / N), i % N]), seconds: s }, { line: `⏱ ${fmt(s)}`, emoji: '⚛️'.repeat(N) });
    }
  }
}

/* ---------- DAILY 5 ---------- */
function daily5(st) {
  const Q = P.daily5;
  st.append($(`<p class="how">${Q.length} questions, 2 minutes. No negative marking.</p>`));
  const bars = $(`<div class="qnum">${Q.map(() => '<i></i>').join('')}</div>`);
  const box = $(`<div style="display:flex;flex-direction:column;gap:12px"></div>`);
  st.append(bars, box);
  let i = 0, score = 0, left = 120, over = false; const answers = [], marks = [], weak = [];
  const t0 = Date.now(), tm = document.getElementById('tm'); tm.textContent = fmt(left);
  tick = setInterval(() => { left = 120 - Math.floor((Date.now() - t0) / 1000); tm.textContent = fmt(Math.max(left, 0)); if (left <= 0 && !over) end(); }, 500);
  function show() {
    bars.children[i].classList.add('cur');
    const q = Q[i]; box.innerHTML = '';
    box.append($(`<div class="eyebrow">Q${i + 1} · ${q.s}</div>`), $(`<div class="qtext">${esc(q.q)}</div>`));
    const m = $(`<div class="mopts"></div>`);
    q.o.forEach((o, k) => {
      const b = $(`<button class="mopt"><b>${'ABCD'[k]}</b>${esc(o)}</button>`);
      b.onclick = async () => {
        if (over || m.dataset.locked) return; m.dataset.locked = 1;
        let j;
        try { j = await api('/api/check/daily5', { date: P.date, q: i, option: k, track: track() }); }
        catch (e) { delete m.dataset.locked; box.append($(`<div class="toast">${esc(e.message)}</div>`)); return; }
        if (over) return;
        answers[i] = k; if (j.correct) score++; else if (!weak.includes(Q[i].s)) weak.push(Q[i].s); marks.push(j.correct ? '✅' : '❌');
        b.classList.add(j.correct ? 'right' : 'wrong'); m.children[j.answer].classList.add('right');
        box.append($(`<div class="fact">${esc(j.explanation)}</div>`));
        bars.children[i].classList.remove('cur'); bars.children[i].classList.add(j.correct ? 'ok' : 'no');
        setTimeout(() => { if (over) return; i++; i < Q.length ? show() : end(); }, 1600);
      };
      m.append(b);
    });
    box.append(m);
  }
  function end() {
    over = true; stopTick();
    while (marks.length < Q.length) marks.push('⏳');
    box.innerHTML = `<div class="qtext">You scored ${score}/${Q.length}</div>`;
    finish('daily5', { answers, seconds: Math.min(120, Math.floor((Date.now() - t0) / 1000)) }, { line: `${score}/${Q.length}`, emoji: marks.join(''), weak: Q.filter((q, n) => answers[n] == null).reduce((w, q) => w.includes(q.s) ? w : w.concat(q.s), weak.slice()) });
  }
  show();
}

/* ---------- RESULT / REGISTER / SHARE ---------- */
function openSheet(id) {
  const g = GAMES.find(x => x.id === id);
  const scrim = $(`<div class="scrim"><div class="sheet" role="dialog" aria-modal="true"></div></div>`);
  scrim.addEventListener('click', e => { if (e.target === scrim) home(); });
  sheetRoot.innerHTML = ''; sheetRoot.append(scrim);
  const sh = scrim.firstElementChild;
  me ? shareView(sh, g) : registerView(sh, g);
}
function registerView(sh, g) {
  const d = resultOf(g.id);
  sh.innerHTML = '';
  sh.append($(`<div class="eyebrow">${gname(g)} #${P.no} · ${esc(d.line)}</div>`), $(`<h3>Nice! Save your score</h3>`),
    $(`<p class="how" style="font-size:15px">Enter your WhatsApp number${track() === 'junior' ? ' (or a parent\'s)' : ''} to keep your 🔥 streak, see your ${esc(rankLabel())} rank and get your own invite link.</p>`));
  const f = $(`<form style="display:flex;flex-direction:column;gap:10px" novalidate>
    <div class="field"><label for="rname">Your name</label><input id="rname" autocomplete="name" maxlength="60" placeholder="e.g. Fathima"></div>
    <div class="field"><label for="rphone">WhatsApp number</label><input id="rphone" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="10-digit mobile number"></div>
    <div class="field" id="otpf" hidden><label for="rotp">OTP sent to your WhatsApp <span id="demo"></span></label><input id="rotp" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="4-digit OTP"></div>
    <p class="err" id="rerr"></p>
    <button class="primary" id="rgo" type="submit">Send OTP on WhatsApp</button>
    <button class="ghost" id="rskip" type="button">Not now</button></form>`);
  sh.append(f);
  const go = f.querySelector('#rgo'), errEl = f.querySelector('#rerr'); let step = 0;
  f.querySelector('#rskip').onclick = home;
  f.onsubmit = async e => {
    e.preventDefault(); errEl.textContent = '';
    const name = f.querySelector('#rname').value.trim(), phone = f.querySelector('#rphone').value.replace(/\D/g, '');
    if (!name) { errEl.textContent = 'Enter your name'; return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { errEl.textContent = 'Enter a valid 10-digit Indian mobile number'; return; }
    go.disabled = true;
    try {
      if (step === 0) {
        const j = await api('/api/otp/send', { phone });
        step = 1; f.querySelector('#otpf').hidden = false; go.textContent = 'Verify & save score';
        if (j.demo) f.querySelector('#demo').innerHTML = `<span class="demo">test OTP: ${esc(j.demo)}</span>`;
        f.querySelector('#rotp').focus();
      } else {
        const ref = ls.get('yd-ref', {}) || {};
        const j = await api('/api/otp/verify', { phone, name, otp: f.querySelector('#rotp').value, ref: ref.r, source: ref.s, class: cls });
        token = j.token; me = j.me; ls.set('yd-token', token);
        await submitAll();
        shareView(sh, g);
      }
    } catch (ex) { errEl.textContent = ex.message; }
    go.disabled = false;
  };
}
function shareText(g, d) {
  return `🧬 YNeet Daily${track() === 'neet' ? '' : ' ' + T().short + ' (' + T().label + ')'} #${P.no} · ${dateLabel(P.date)}\n${gname(g)}: ${d.line}\n${d.emoji}\n🔥 Streak: ${me.streak} day${me.streak === 1 ? '' : 's'}\n\nCan you beat me? Play free 👇\n${playUrl()}?r=${me.code}`;
}
/* ---------- LEADERBOARD: all five games ---------- */
async function leaderboard() {
  stopTick(); sheetRoot.innerHTML = '';
  app.innerHTML = '';
  const head = $(`<div class="stagehead"><button class="back">← Games</button><h2>${track() === 'neet' ? 'Leaderboard' : esc(T().label) + ' leaderboard'} <small class="eyebrow">#${P.no}</small></h2></div>`);
  head.querySelector('.back').onclick = home;
  app.append(head, $(`<p class="how">Today's ${track() === 'neet' ? 'All-India' : esc(T().label)} top 10 for each game. Ranks go by score, then by time. Boards reset at midnight.</p>`));
  const box = $(`<div style="display:flex;flex-direction:column;gap:12px"><div class="loading">Loading boards…</div></div>`);
  app.append(box);
  window.scrollTo(0, 0);
  let data;
  try { data = await api('/api/boards?date=' + P.date + '&track=' + track()); } catch (e) { box.innerHTML = `<div class="loading">${esc(e.message)}</div>`; return; }
  box.innerHTML = '';
  if (!me) {
    const join = $(`<div class="panel" style="display:flex;flex-direction:column;gap:8px"><strong>See your own rank</strong><span class="how">Finish any game today and save your score with your WhatsApp number. Your rank then shows here on any phone.</span></div>`);
    box.append(join);
  }
  for (const g of GAMES) {
    const b = data.boards[g.id];
    const p = $(`<div class="panel lbpanel"><div class="lbhead"><span class="gicon sm" style="background:${g.color}">${g.icon}</span><strong>${gname(g)}</strong><span class="lbcount">${b.total} solved</span></div></div>`);
    if (me) {
      let mine;
      if (b.mine && b.mine.rank) mine = `<div class="rankline">🏆 Your rank: #${b.mine.rank} of ${b.mine.total} · ${esc(b.mine.line)}</div>`;
      else if (b.mine) mine = `<div class="how">You played (${esc(b.mine.line)}) but didn't solve it today.</div>`;
      else mine = `<button class="ghost lbplay">Play ${gname(g)} to get ranked</button>`;
      const m = $(`<div>${mine}</div>`); const btn = m.querySelector('.lbplay'); if (btn) btn.onclick = () => openGame(g.id);
      p.append(m);
    }
    p.append($(`<div class="board">${b.top.length ? b.top.map(x => `<div class="${x.me ? 'me' : ''}"><b>#${x.rank}</b><span>${esc(x.name)}${x.me ? ' (you)' : ''}</span><span>${esc(x.line)}</span></div>`).join('') : '<div>No one has solved it yet today. Be the first!</div>'}</div>`));
    box.append(p);
  }
}

async function shareView(sh, g) {
  const d = resultOf(g.id), local = day.done[g.id];
  const txt = shareText(g, d), need = me.needed, r = Math.min(me.referrals, need);
  sh.innerHTML = '';
  const rank = local && local.rank;
  sh.append($(`<div class="eyebrow">Saved for ${esc(me.name)}</div>`), $(`<h3>Share your result</h3>`));
  const rankEl = $(`<div class="rankline"></div>`); sh.append(rankEl);
  if (rank) rankEl.textContent = `🏆 ${rankLabel()} rank #${rank.rank} of ${rank.total} today`;
  else { rankEl.hidden = true; api('/api/boards?date=' + P.date + '&track=' + track()).then(j => { const m = j.boards[g.id] && j.boards[g.id].mine; if (m && m.rank) { rankEl.textContent = `🏆 ${rankLabel()} rank #${m.rank} of ${m.total} today`; rankEl.hidden = false; } }).catch(() => {}); }
  const res = $(`<div class="result"></div>`); res.textContent = txt; sh.append(res);
  sh.append($(`<a class="primary wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">Share on WhatsApp</a>`));
  const row = $(`<div class="row2"><button class="ghost" id="cp">Copy message</button><button class="ghost" id="sc">Status card</button></div>`);
  sh.append(row);
  row.querySelector('#cp').onclick = async e => {
    try { await navigator.clipboard.writeText(txt); e.target.textContent = 'Copied ✓'; }
    catch (_) { const rng = document.createRange(); rng.selectNodeContents(res); const s = getSelection(); s.removeAllRanges(); s.addRange(rng); e.target.textContent = 'Selected, copy it'; }
  };
  row.querySelector('#sc').onclick = statusCard;
  sh.append($(`<div class="panel" style="display:flex;flex-direction:column;gap:8px">
    <strong>Invite ${need} friends → 1 month YNeet free</strong>
    <div class="bar"><i style="width:${r / need * 100}%"></i></div>
    <div class="reftext"><span>${r}/${need} registered with your link</span><span>Code ${me.code}</span></div>
    ${me.rewardCode ? rewardBox() : '<span class="how">A friend counts when they register using your link.</span>'}</div>`));
  sh.append(yneetPanel(g.id, (local && local.preview) || d));
  const board = $(`<div class="panel" style="display:flex;flex-direction:column;gap:8px"><strong>Today's top 10 · ${gname(g)}${track() === 'neet' ? '' : ' · ' + esc(T().label)}</strong><div class="board"><div>Loading…</div></div></div>`);
  sh.append(board);
  const done = $(`<button class="ghost">Back to games</button>`); done.onclick = home; sh.append(done);
  try {
    const rows = await fetch(`/api/leaderboard?date=${P.date}&game=${g.id}&track=${track()}`).then(x => x.json());
    board.querySelector('.board').innerHTML = rows.length ? rows.map(x => `<div><b>#${x.rank}</b><span>${esc(x.name)}</span><span>${esc(x.line)}</span></div>`).join('') : '<div>Be the first on the board today!</div>';
  } catch (e) { board.remove(); }
}
function statusCard() {
  const link = (playUrl() + (me ? `?r=${me.code}&s=status` : '?s=status')).replace(/^https?:\/\//, '');
  const scrim = $(`<div class="scrim" style="align-items:center"><div style="display:flex;flex-direction:column;gap:12px;align-items:center;padding:16px">
    <div class="status">
      <div><div class="s1">YNeet <span>Daily</span></div><div style="font-family:var(--mono);font-size:12px;margin-top:6px;opacity:.85">#${P.no} · ${dateLabel(P.date).toUpperCase()} · ${track() === 'neet' ? '5 FREE NEET GAMES' : '5 FREE SCIENCE GAMES · ' + esc(T().label.toUpperCase())}</div></div>
      <div class="s2">Today's ${esc(gname(GAMES[0]))}: ${P.bioword.length} letters, ${esc(P.bioword.hint.toLowerCase())} 🌿<br>Can you crack it?</div>
      <div class="games">🟩 ${esc(gname(GAMES[0]))}<br>🔵 ${esc(gname(GAMES[1]))}<br>🔴 Pathway Zip<br>⚛ Element Queens<br>🟠 Daily 5 MCQs</div>
      <div class="link">${esc(link)}</div>
    </div>
    <p style="color:#fff;margin:0;text-align:center;font-size:13px">Take a screenshot and post it to your WhatsApp Status</p>
    <button class="ghost" id="scx">Close</button></div></div>`);
  sheetRoot.innerHTML = ''; sheetRoot.append(scrim);
  scrim.querySelector('#scx').onclick = home;
}

/* ---------- boot ---------- */
async function loadTrack() {
  P = await api('/api/today?track=' + track());
  day = ls.get(dayKey(), null) || { done: {} };
}

/* ---------- CLASS PICKER ---------- */
function classPicker(changing) {
  stopTick(); sheetRoot.innerHTML = '';
  app.innerHTML = '';
  app.append($(`<div class="top"><div><div class="eyebrow">Raise Academy presents</div><div class="brand"><h1>YNeet <span>Daily</span></h1></div></div></div>`));
  const p = $(`<div class="panel picker">
    <h3>${changing ? 'Change your class' : 'Which class are you in?'}</h3>
    <p class="how" style="margin:0">You get puzzles from your own syllabus and your own leaderboard.</p>
    <div class="pgroup"><div class="eyebrow">Class 6–8 · science puzzles</div><div class="pgrid" data-g="j"></div></div>
    <div class="pgroup"><div class="eyebrow">Class 9–10 · NEET Foundation</div><div class="pgrid" data-g="f"></div></div>
    <div class="pgroup"><div class="eyebrow">Class 11–12 & droppers · NEET</div><div class="pgrid" data-g="n"></div></div>
  </div>`);
  const groups = { j: ['6', '7', '8'], f: ['9', '10'], n: ['11', '12', 'Dropper'] };
  for (const [k, list] of Object.entries(groups)) {
    const grid = p.querySelector(`[data-g="${k}"]`);
    list.forEach(c => {
      const b = $(`<button class="pbtn ${cls === c ? 'on' : ''}" type="button">${c === 'Dropper' ? 'Dropper' : 'Class ' + c}</button>`);
      b.onclick = () => chooseClass(c);
      grid.append(b);
    });
  }
  app.append(p);
  if (changing) { const back = $(`<button class="ghost" style="align-self:center">Cancel</button>`); back.onclick = home; app.append(back); }
  window.scrollTo(0, 0);
}
async function chooseClass(c) {
  cls = c; ls.set('yd-class', c);
  app.innerHTML = `<div class="loading">Loading ${esc(T().label)} puzzles…</div>`;
  try {
    if (me) { try { me = await api('/api/me/class', { class: c }); } catch (e) { console.warn(e.message); } }
    await loadTrack();
    if (me) await submitAll();
    home();
  } catch (e) {
    app.innerHTML = `<div class="loading">Couldn't load the puzzles. ${esc(e.message)}<br><br><button class="ghost" onclick="location.reload()">Try again</button></div>`;
  }
}

/* ---------- boot ---------- */
(async function boot() {
  try {
    cls = ls.get('yd-class', null);
    if (token) { try { me = await api('/api/me'); if (me && me.class) { cls = me.class; ls.set('yd-class', cls); } } catch (e) { console.warn(e.message); } }
    if (!cls) { classPicker(false); return; }
    if (me && !me.class) { try { me = await api('/api/me/class', { class: cls }); } catch (e) { console.warn(e.message); } }
    await loadTrack();
    if (me) await submitAll();
    home();
  } catch (e) {
    app.innerHTML = `<div class="loading">Couldn't load today's puzzles. ${esc(e.message)}<br><br><button class="ghost" onclick="location.reload()">Try again</button></div>`;
  }
})();
})();
