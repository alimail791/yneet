// End-to-end API test. Needs a running server started with DEV_OTP=1234, PUZZLE_DATE and ADMIN_KEY.
// BASE=http://localhost:3000 ADMIN_KEY=... node test/e2e.js
const assert = require('assert');
const P = require('../puzzles/puzzles.json');
const BASE = process.env.BASE || 'http://localhost:3000';
const OTP = process.env.DEV_OTP || '1234';

async function call(path, body, token, headers = {}) {
  const r = await fetch(BASE + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
  return { status: r.status, body: j };
}
async function signup(phone, name, ref, source) {
  let r = await call('/api/otp/send', { phone }); assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call('/api/otp/verify', { phone, name, otp: '0000', ref, source }); assert.equal(r.status, 400, 'wrong OTP rejected');
  r = await call('/api/otp/verify', { phone, name, otp: OTP, ref, source }); assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
let n = 0; const ok = m => console.log(`✓ ${++n}. ${m}`);

(async () => {
  const t = await call('/api/today'); assert.equal(t.status, 200);
  const date = t.body.date, p = P[date];
  assert.ok(p, 'puzzle exists for ' + date);
  assert.ok(!JSON.stringify(t.body).includes(p.bioword.answer), 'answer not leaked');
  assert.ok(!('a' in t.body.daily5[0]), 'MCQ answer not leaked');
  ok(`today = ${date} (#${t.body.no}), answers hidden`);

  let r = await call('/api/check/bioword', { date, guess: 'Z'.repeat(p.bioword.answer.length), attempt: 1 });
  assert.deepEqual(r.body.solved, false); assert.ok(!r.body.answer);
  r = await call('/api/check/bioword', { date, guess: p.bioword.answer, attempt: 2 });
  assert.equal(r.body.solved, true); assert.ok(r.body.fact);
  ok('BioWord check: wrong then right');

  r = await call('/api/check/pinpoint', { date, option: p.pinpoint.options.find(o => o !== p.pinpoint.answer), guessNo: 1 });
  assert.equal(r.body.correct, false); assert.equal(r.body.nextClue, p.pinpoint.clues[1]);
  ok('Pinpoint wrong guess reveals clue 2');

  const A = await signup('9876500001', 'Fathima Khan', null, 'status');
  const tokA = A.token, codeA = A.me.code;
  ok(`Player A registered, code ${codeA}`);

  // submit all five games for A
  const zipLast = Math.max(...Object.values(p.zip.nodes));
  const att = {
    bioword: { guesses: ['Z'.repeat(p.bioword.answer.length), p.bioword.answer], seconds: 40 },
    pinpoint: { guesses: [p.pinpoint.answer], seconds: 15 },
    zip: { path: p.zip.solution[0] === +Object.keys(p.zip.nodes).find(k => p.zip.nodes[k] === 1) ? p.zip.solution : p.zip.solution.slice().reverse(), seconds: 50 },
    queens: { cells: p.queens.solution.map((c, row) => [row, c]), seconds: 70 },
    daily5: { answers: p.daily5.map((q, i) => i === 4 ? (q.a + 1) % 4 : q.a), seconds: 60 }
  };
  assert.equal(p.zip.nodes[att.zip.path[att.zip.path.length - 1]], zipLast);
  for (const [game, attempt] of Object.entries(att)) {
    r = await call('/api/results', { date, game, attempt }, tokA);
    assert.equal(r.status, 200, game + ' ' + JSON.stringify(r.body));
    console.log(`   ${game}: ${r.body.result.line}  rank ${r.body.rank && r.body.rank.rank}/${r.body.rank && r.body.rank.total}`);
  }
  assert.equal(r.body.result.line, '4/5');
  assert.equal(r.body.me.streak, 1);
  ok('A submitted all 5 games, results verified on server, streak 1');

  // cheating attempts rejected
  r = await call('/api/results', { date, game: 'queens', attempt: { cells: [[0, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] } }, tokA);
  assert.equal(r.status, 400, 'invalid board rejected even after a valid one');
  const B0 = await signup('9876500002', 'Rahul Nair', codeA);
  r = await call('/api/results', { date, game: 'queens', attempt: { cells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]] } }, B0.token);
  assert.equal(r.status, 400);
  r = await call('/api/results', { date, game: 'zip', attempt: { path: [0, 1, 2] } }, B0.token);
  assert.equal(r.status, 400);
  r = await call('/api/results', { date, game: 'bioword', attempt: { guesses: ['A'.repeat(p.bioword.answer.length)] } }, B0.token);
  assert.equal(r.status, 400, 'unfinished bioword rejected');
  r = await call('/api/results', { date, game: 'pinpoint', attempt: { guesses: [p.pinpoint.answer] } });
  assert.equal(r.status, 401);
  ok('Invalid boards, short paths, unfinished games and missing login are rejected');

  // referrals
  r = await call('/api/me', null, tokA); assert.equal(r.body.referrals, 1); assert.ok(!r.body.rewardCode);
  await new Promise(s => setTimeout(s, 1100));
  await signup('9876500002', 'Rahul Nair', codeA); // same person again must not count twice
  r = await call('/api/me', null, tokA); assert.equal(r.body.referrals, 1);
  await signup('9876500003', 'Sneha', codeA);
  r = await call('/api/me', null, tokA); assert.equal(r.body.referrals, 2); assert.ok(!r.body.rewardCode);
  await signup('9876500004', 'Arjun', codeA);
  r = await call('/api/me', null, tokA); assert.equal(r.body.referrals, 3); assert.equal(r.body.rewardCode, 'FREE-' + codeA);
  ok(`3 unique friends → reward ${r.body.rewardCode}; repeat sign-up not double counted`);

  r = await call('/api/leaderboard?date=' + date + '&game=bioword');
  assert.equal(r.body[0].name, 'Fathima K.');
  ok('Leaderboard shows short names');

  r = await call('/api/admin/stats'); assert.equal(r.status, 401);
  r = await call('/api/admin/stats', null, null, { 'x-admin-key': process.env.ADMIN_KEY });
  assert.equal(r.body.players, 4); assert.equal(r.body.rewardsUnlocked, 1);
  console.log('   stats:', JSON.stringify(r.body));
  r = await call('/api/admin/players.csv', null, null, { 'x-admin-key': process.env.ADMIN_KEY });
  assert.ok(r.body.startsWith('name,phone,code')); assert.equal(r.body.trim().split('\n').length, 5);
  ok('Admin stats and Senda CSV export work (and need the key)');

  await call('/api/otp/send', { phone: '9876500009' });
  r = await call('/api/otp/send', { phone: '9876500009' }); assert.equal(r.status, 429);
  ok('OTP resend inside the wait time is blocked');
  console.log('\nAll tests passed.');
})().catch(e => { console.error('✗ FAILED:', e.message); process.exit(1); });
