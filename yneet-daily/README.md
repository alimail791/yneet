# YNeet Daily

Five free NEET puzzle games every day (BioWord, Pinpoint NEET, Pathway Zip, Element Queens, Daily 5).
Students play first, then register with a WhatsApp OTP to save their score, streak and All-India rank.
Each player gets a personal link (`/play?r=CODE`). When 3 friends register through it, the player
unlocks a free month of YNeet (`FREE-CODE`).

## How it fits together

```
WhatsApp Status / shared link ──► /play?r=CODE&s=status
        │
        ▼
  play a game (answers checked by the server, never sent to the phone)
        │
        ▼
  name + WhatsApp number ──► OTP via Raise Academy WhatsApp number ──► player saved
        │                                                              │
        ▼                                                              ▼
  share card with own link + rank                     referrer gets +1; at 3 → reward code,
                                                      WhatsApp message, optional webhook to YNeet
```

## Run locally

```bash
npm install
cp .env.example .env      # fill DATABASE_URL, set DEV_OTP=1234 for testing
node --env-file=.env server.js
# open http://localhost:3000/play
```

Tests (server must be running with `DEV_OTP=1234 OTP_RESEND_SECONDS=1 PUZZLE_DATE=2026-10-24` on an empty database):

```bash
BASE=http://localhost:3000 ADMIN_KEY=... npm test
```

## Deploy on Railway

1. Push this folder to a GitHub repo (or a `yneet-daily/` folder in an existing repo and set the service's root directory to it).
2. In the YNeet Railway project: **New → GitHub repo**, pick it. Add a **Postgres** service if the project doesn't have one.
3. Variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `SESSION_SECRET`, `ADMIN_KEY`, the `WA_*` values. Do **not** set `DEV_OTP`.
4. Domain: add `play.yneet.in` (CNAME in GoDaddy to the Railway target). Share links then look like `play.yneet.in/play?r=YN7K2Q`.
   To use `www.yneet.in/play` instead, proxy `/play`, `/api/*`, `/style.css`, `/app.js` from the main site to this service.
5. Check `https://play.yneet.in/health`; it shows today's date and whether WhatsApp OTP is on.

## WhatsApp templates (create in Meta Business Manager)

- **OTP** — category *Authentication*, name `yneet_otp`, with the "Copy code" button. Meta writes the text for you.
- **Reward** (optional) — category *Utility*, e.g. `yneet_referral_reward`:
  "Congrats {{1}}! 3 friends joined YNeet Daily with your link. Your free month code is {{2}}. Reply here to activate it."

Authentication messages are charged per message by Meta (a few paise each in India).

## Daily puzzles (a full year)

There is one new set of five puzzles every day for 365 days (24 Oct 2026 to 23 Oct 2027, #2 to #366).
Nothing repeats within the year: 365 BioWords, 365 Pinpoint sets (Bio, Chem and Phy chapters), 365 Zip pathways,
365 Queens boards and 1,825 Daily 5 MCQs (3 Bio, 1 Chem, 1 Phy each day). After the year the cycle starts again,
and the puzzle number keeps counting up.

- `puzzles/content.js`: the first 30 days (already live, kept unchanged).
- `puzzles/year/*.txt`: content for days 31 to 365, one item per line, easy to edit:
  - `bioword.txt`: `WORD | hint | fact`
  - `pinpoint.txt`: `Subject | NCERT chapter | clue1; clue2; clue3; clue4; clue5` (hardest clue first)
  - `zip.txt`: `Title | step 1 > step 2 > ...`
  - `mcq_*.txt`: `question | correct answer | wrong 1 | wrong 2 | wrong 3 | explanation` (options are shuffled automatically)
- `puzzles/generate.js` builds `puzzles/puzzles.json`. Zip paths and Queens boards are generated with a fixed seed;
  every Queens board has exactly one solution. Boards grow through the week: Zip 5x5 (Mon, Tue), 6x6 (Wed to Fri), 7x7 (weekend);
  Queens 6x6, 7x7 and 8x8 on the same pattern. MCQs and Pinpoint sets rotate across chapters so neighbouring days differ.
- `puzzles/review.js` writes a review page with every puzzle and its answer.

```bash
node puzzles/generate.js          # rebuild the year after editing content
node puzzles/review.js review.html
```

To fix a wrong answer, edit the line in the `year/` file and regenerate. Avoid editing a day that is already live or past:
players' saved results are checked against that day's puzzle.

## Admin

- `GET /api/admin/stats?key=ADMIN_KEY` — players, new today, sign-ups by source, plays per game, rewards, top referrers
- `GET /api/admin/players.csv?key=ADMIN_KEY` — name, phone, code, referrer, source, referrals, games played, last played, reward code. Import into Senda for follow-ups.

Activating a reward: the player sends their `FREE-` code to Raise Academy on WhatsApp; check it in the CSV and add a month to their YNeet plan.
Set `YNEET_REWARD_WEBHOOK` later to automate this.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/today` | Today's puzzles (IST), without answers |
| POST | `/api/check/bioword` | `{date, guess, attempt}` → colours |
| POST | `/api/check/pinpoint` | `{date, option, guessNo}` → correct / next clue |
| POST | `/api/check/daily5` | `{date, q, option}` → correct answer + explanation |
| POST | `/api/otp/send` | `{phone}` |
| POST | `/api/otp/verify` | `{phone, otp, name, ref, source}` → token |
| GET | `/api/me` | streak, referrals, reward code, today's results |
| POST | `/api/results` | `{date, game, attempt}`; the server re-checks the whole attempt |
| GET | `/api/leaderboard?date&game` | Top 10 |
