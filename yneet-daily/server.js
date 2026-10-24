// YNeet Daily: daily NEET puzzle games with WhatsApp sign-up and referral rewards.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const G = require('./lib/games');
const wa = require('./lib/whatsapp');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || (console.warn('⚠ SESSION_SECRET not set, using a random one (logins reset on restart)'), crypto.randomBytes(32).toString('hex'));
const REFERRALS_NEEDED = +(process.env.REFERRALS_NEEDED || 3);
const HOUSE_CODES = (process.env.HOUSE_CODES || 'STATUS').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined });
const q = (text, params) => pool.query(text, params);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  const allowed = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const o = req.headers.origin;
  if (o && allowed.includes(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization'); }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- helpers ----------
const sign = obj => { const b = Buffer.from(JSON.stringify(obj)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url'); };
const unsign = tok => {
  const [b, s] = String(tok || '').split('.');
  if (!b || !s) return null;
  const want = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  if (s.length !== want.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want))) return null;
  const o = JSON.parse(Buffer.from(b, 'base64url').toString());
  return o.exp > Date.now() ? o : null;
};
const hash = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const normPhone = p => { const d = String(p || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''); return /^[6-9]\d{9}$/.test(d) ? d : null; };
const newCode = () => 'YN' + Array.from(crypto.randomBytes(4), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
const shortName = n => { const p = n.trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : ''); };
const err = (res, code, msg) => res.status(code).json({ error: msg });

const hits = new Map(); // tiny in-memory rate limiter
function limited(key, max, windowMs) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 36e5)) hits.delete(k); }, 6e5).unref();

function auth(req, res, next) {
  const t = unsign((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!t) return err(res, 401, 'Please verify your WhatsApp number again');
  req.playerId = t.id; next();
}
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); err(res, 500, 'Something went wrong. Please try again.'); });

async function streakOf(playerId) {
  const { rows } = await q('SELECT DISTINCT day::text AS d FROM results WHERE player_id=$1 ORDER BY d DESC LIMIT 400', [playerId]);
  if (!rows.length) return 0;
  const today = G.today();
  let expect = rows[0].d === today ? today : (G.dayDiff(today, rows[0].d) === 1 ? rows[0].d : null);
  if (!expect) return 0;
  let n = 0;
  for (const { d } of rows) { if (d !== expect) break; n++; const t = new Date(expect + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); expect = t.toISOString().slice(0, 10); }
  return n;
}
async function rankOf(day, game, score, seconds) {
  const { rows } = await q(`SELECT
      COUNT(*) FILTER (WHERE score > $3 OR (score = $3 AND seconds < $4))::int + 1 AS rank,
      COUNT(*)::int AS total
    FROM results WHERE day=$1 AND game=$2 AND solved`, [day, game, score, seconds]);
  return rows[0];
}
async function playerSummary(id) {
  const { rows: [p] } = await q('SELECT id,name,code,reward_code FROM players WHERE id=$1', [id]);
  if (!p) return null;
  const { rows: [r] } = await q('SELECT COUNT(*)::int AS n FROM players WHERE referred_by=$1', [p.code]);
  const { rows: done } = await q('SELECT game,line,emoji,score,seconds,solved FROM results WHERE player_id=$1 AND day=$2', [id, G.today()]);
  return { name: p.name, code: p.code, referrals: r.n, needed: REFERRALS_NEEDED, rewardCode: p.reward_code,
    streak: await streakOf(id), today: Object.fromEntries(done.map(d => [d.game, d])) };
}

// ---------- puzzles ----------
app.get('/api/today', (req, res) => {
  const p = G.puzzleFor(G.today());
  if (p.recycled) console.warn(`⚠ No new puzzle for ${p.date}; recycling. Run: node puzzles/generate.js <start> <days>`);
  res.set('Cache-Control', 'no-store').json(G.publicView(p));
});
const dayOk = d => { const t = G.today(), diff = G.dayDiff(t, d || ''); return d && (diff === 0 || diff === 1); };

app.post('/api/check/:game', (req, res) => {
  if (limited('chk:' + req.ip, 300, 6e5)) return err(res, 429, 'Too many tries. Wait a few minutes.');
  const { date } = req.body;
  if (!dayOk(date)) return err(res, 400, "This puzzle has expired. Refresh for today's puzzle.");
  const p = G.puzzleFor(date);
  let out;
  if (req.params.game === 'bioword') out = G.checkBioword(p, req.body.guess, +req.body.attempt || 1);
  else if (req.params.game === 'pinpoint') out = G.checkPinpoint(p, req.body.option, +req.body.guessNo || 1);
  else if (req.params.game === 'daily5') out = G.checkDaily5(p, +req.body.q, +req.body.option);
  else return err(res, 404, 'Unknown game');
  if (out.error) return err(res, 400, out.error);
  res.json(out);
});

// ---------- sign-up by WhatsApp OTP ----------
app.post('/api/otp/send', wrap(async (req, res) => {
  const phone = normPhone(req.body.phone);
  if (!phone) return err(res, 400, 'Enter a valid 10-digit Indian mobile number');
  if (limited('otpip:' + req.ip, +(process.env.OTP_PER_IP_HOUR || 60), 36e5) || limited('otpph:' + phone, 5, 36e5)) return err(res, 429, 'Too many OTP requests. Try again in an hour.');
  const { rows: [last] } = await q('SELECT sent_at FROM otps WHERE phone=$1', [phone]);
  const gap = +(process.env.OTP_RESEND_SECONDS || 45);
  if (last && Date.now() - new Date(last.sent_at) < gap * 1000) return err(res, 429, `Please wait ${gap} seconds before asking for another OTP.`);
  let code, demo = false;
  if (wa.configured()) code = String(crypto.randomInt(1000, 10000));
  else if (process.env.DEV_OTP) { code = process.env.DEV_OTP; demo = true; }
  else return err(res, 503, 'OTP sending is not set up yet.');
  await q(`INSERT INTO otps(phone,code_hash,expires_at,attempts,sent_at) VALUES($1,$2,now()+interval '10 minutes',0,now())
           ON CONFLICT(phone) DO UPDATE SET code_hash=$2, expires_at=now()+interval '10 minutes', attempts=0, sent_at=now()`, [phone, hash(phone + code)]);
  if (!demo) {
    try { await wa.sendOtp(phone, code); }
    catch (e) { console.error('OTP send failed', e.message, JSON.stringify(e.meta || {})); return err(res, 502, 'Could not send the OTP on WhatsApp. Check the number and try again.'); }
  }
  res.json({ sent: true, demo: demo ? code : undefined });
}));

app.post('/api/otp/verify', wrap(async (req, res) => {
  const phone = normPhone(req.body.phone), name = String(req.body.name || '').trim().slice(0, 60);
  const otp = String(req.body.otp || '').trim();
  if (!phone) return err(res, 400, 'Enter a valid 10-digit Indian mobile number');
  const { rows: [o] } = await q('SELECT * FROM otps WHERE phone=$1', [phone]);
  if (!o || new Date(o.expires_at) < new Date()) return err(res, 400, 'OTP expired. Tap "Send OTP" again.');
  if (o.attempts >= 5) return err(res, 429, 'Too many wrong attempts. Request a new OTP.');
  if (hash(phone + otp) !== o.code_hash) { await q('UPDATE otps SET attempts=attempts+1 WHERE phone=$1', [phone]); return err(res, 400, 'Wrong OTP. Check the WhatsApp message and try again.'); }
  await q('DELETE FROM otps WHERE phone=$1', [phone]);

  let { rows: [p] } = await q('SELECT id FROM players WHERE phone=$1', [phone]);
  let rewardFor = null;
  if (!p) {
    if (!name) return err(res, 400, 'Enter your name');
    const ref = String(req.body.ref || '').trim().toUpperCase().slice(0, 16) || null;
    const source = String(req.body.source || (ref ? 'share' : 'direct')).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
    let referrer = null;
    if (ref && !HOUSE_CODES.includes(ref)) ({ rows: [referrer] } = await q('SELECT id,name,phone,code,reward_code FROM players WHERE code=$1', [ref]));
    const referredBy = referrer ? referrer.code : (HOUSE_CODES.includes(ref) ? ref : null);
    for (let i = 0; i < 5 && !p; i++) {
      ({ rows: [p] } = await q(`INSERT INTO players(phone,name,code,referred_by,source) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT DO NOTHING RETURNING id`, [phone, name, newCode(), referredBy, source]));
      if (!p) ({ rows: [p] } = await q('SELECT id FROM players WHERE phone=$1', [phone])); // raced with another verify
    }
    if (referrer && !referrer.reward_code) {
      const { rows: [{ n }] } = await q('SELECT COUNT(*)::int AS n FROM players WHERE referred_by=$1', [referrer.code]);
      if (n >= REFERRALS_NEEDED) {
        const { rowCount } = await q(`UPDATE players SET reward_code=$2, reward_at=now() WHERE id=$1 AND reward_code IS NULL`, [referrer.id, 'FREE-' + referrer.code]);
        if (rowCount) rewardFor = { ...referrer, reward_code: 'FREE-' + referrer.code };
      }
    }
  } else if (name) {
    await q('UPDATE players SET name=$2 WHERE id=$1', [p.id, name]);
  }
  if (rewardFor) notifyReward(rewardFor);
  res.json({ token: sign({ id: p.id, exp: Date.now() + 180 * 864e5 }), me: await playerSummary(p.id) });
}));

function notifyReward(r) {
  wa.sendReward(r.phone, r.name.split(' ')[0], r.reward_code).catch(e => console.error('Reward WhatsApp failed', e.message));
  if (process.env.YNEET_REWARD_WEBHOOK) {
    fetch(process.env.YNEET_REWARD_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': process.env.YNEET_WEBHOOK_SECRET || '' },
      body: JSON.stringify({ event: 'referral_reward', phone: r.phone, name: r.name, code: r.code, rewardCode: r.reward_code, months: 1 })
    }).catch(e => console.error('Reward webhook failed', e.message));
  }
  console.log(`🎉 Reward unlocked for ${r.name} (${r.code}): ${r.reward_code}`);
}

// ---------- player ----------
app.get('/api/me', auth, wrap(async (req, res) => {
  const me = await playerSummary(req.playerId);
  if (!me) return err(res, 401, 'Please verify your WhatsApp number again');
  res.json(me);
}));

app.post('/api/results', auth, wrap(async (req, res) => {
  const { date, game, attempt } = req.body;
  if (!dayOk(date)) return err(res, 400, 'This puzzle has expired.');
  const p = G.puzzleFor(date);
  const v = G.verify(p, game, attempt);
  if (v.error) return err(res, 400, v.error);
  await q(`INSERT INTO results(player_id,day,game,line,emoji,score,seconds,solved) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (player_id,day,game) DO NOTHING`, [req.playerId, date, game, v.line, v.emoji, v.score, v.seconds, v.solved]);
  const { rows: [saved] } = await q('SELECT line,emoji,score,seconds,solved FROM results WHERE player_id=$1 AND day=$2 AND game=$3', [req.playerId, date, game]);
  const rank = saved.solved ? await rankOf(date, game, saved.score, saved.seconds) : null;
  res.json({ result: saved, rank, me: await playerSummary(req.playerId) });
}));

app.get('/api/leaderboard', wrap(async (req, res) => {
  const day = req.query.date || G.today(), game = String(req.query.game || '');
  const { rows } = await q(`SELECT p.name, r.line, r.score, r.seconds FROM results r JOIN players p ON p.id=r.player_id
    WHERE r.day=$1 AND r.game=$2 AND r.solved ORDER BY r.score DESC, r.seconds ASC, r.created_at ASC LIMIT 10`, [day, game]);
  res.json(rows.map((r, i) => ({ rank: i + 1, name: shortName(r.name), line: r.line })));
}));

// ---------- admin (header: x-admin-key) ----------
function admin(req, res, next) {
  const k = process.env.ADMIN_KEY;
  if (!k || (req.headers['x-admin-key'] || req.query.key) !== k) return err(res, 401, 'Admin key required');
  next();
}
app.get('/api/admin/stats', admin, wrap(async (req, res) => {
  const day = G.today();
  const [tot, newToday, bySource, plays, rewards, topRef] = await Promise.all([
    q('SELECT COUNT(*)::int n FROM players'),
    q(`SELECT COUNT(*)::int n FROM players WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1`, [day]),
    q('SELECT COALESCE(source,\'direct\') source, COUNT(*)::int n FROM players GROUP BY 1 ORDER BY 2 DESC'),
    q('SELECT game, COUNT(*)::int plays, COUNT(*) FILTER (WHERE solved)::int solved FROM results WHERE day=$1 GROUP BY 1', [day]),
    q('SELECT COUNT(*)::int n FROM players WHERE reward_code IS NOT NULL'),
    q(`SELECT r.code, r.name, COUNT(p.id)::int referrals FROM players r JOIN players p ON p.referred_by=r.code GROUP BY r.id ORDER BY 3 DESC LIMIT 10`)
  ]);
  res.json({ day, players: tot.rows[0].n, newToday: newToday.rows[0].n, bySource: bySource.rows, playsToday: plays.rows, rewardsUnlocked: rewards.rows[0].n, topReferrers: topRef.rows });
}));
app.get('/api/admin/players.csv', admin, wrap(async (req, res) => {
  const { rows } = await q(`SELECT p.name, p.phone, p.code, p.referred_by, p.source, p.reward_code,
      (SELECT COUNT(*) FROM players x WHERE x.referred_by=p.code) referrals,
      (SELECT COUNT(*) FROM results r WHERE r.player_id=p.id) games_played,
      (SELECT MAX(day)::text FROM results r WHERE r.player_id=p.id) last_played,
      to_char(p.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI') joined
    FROM players p ORDER BY p.created_at DESC`);
  const cols = ['name', 'phone', 'code', 'referred_by', 'source', 'referrals', 'games_played', 'last_played', 'reward_code', 'joined'];
  const esc = v => v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="yneet-daily-players.csv"');
  res.send([cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'));
}));

// ---------- page ----------
app.get('/health', (req, res) => res.json({ ok: true, date: G.today(), whatsapp: wa.configured() }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', maxAge: '5m' }));
app.get(['/play', '/play/*'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

(async () => {
  await q(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const last = G.DATES[G.DATES.length - 1], left = G.dayDiff(last, G.today());
  console.log(`Puzzles loaded through ${last} (${left} days left). WhatsApp OTP: ${wa.configured() ? 'on' : (process.env.DEV_OTP ? 'DEMO code ' + process.env.DEV_OTP : 'off')}`);
  app.listen(PORT, () => console.log(`YNeet Daily on :${PORT}`));
})().catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
