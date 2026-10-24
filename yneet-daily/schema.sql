-- YNeet Daily schema. Safe to run on every start.
CREATE TABLE IF NOT EXISTS players (
  id           SERIAL PRIMARY KEY,
  phone        TEXT NOT NULL UNIQUE,          -- 10-digit Indian mobile, no +91
  name         TEXT NOT NULL,
  code         TEXT NOT NULL UNIQUE,          -- personal referral code, e.g. YN7K2Q
  referred_by  TEXT,                          -- code of the player (or house code) who brought them
  source       TEXT,                          -- status | share | direct | ...
  reward_code  TEXT,                          -- set when 3 referrals are reached
  reward_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS players_referred_by ON players(referred_by);

CREATE TABLE IF NOT EXISTS otps (
  phone      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT NOT NULL DEFAULT 0,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS results (
  id         SERIAL PRIMARY KEY,
  player_id  INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  game       TEXT NOT NULL,
  line       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  score      INT NOT NULL,
  seconds    INT NOT NULL,
  solved     BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, day, game)
);
CREATE INDEX IF NOT EXISTS results_board ON results(day, game, score DESC, seconds ASC);
