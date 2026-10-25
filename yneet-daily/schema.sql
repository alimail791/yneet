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

-- Added: free month sync with YNeet, and YNeet button taps
ALTER TABLE players ADD COLUMN IF NOT EXISTS reward_applied_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS reward_note TEXT;
CREATE TABLE IF NOT EXISTS events (
  id         SERIAL PRIMARY KEY,
  player_id  INT REFERENCES players(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL,
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_kind ON events(kind, created_at);

-- Added: class tracks. Each player picks a class; results and leaderboards are per track
-- (neet = Class 11, 12, droppers; foundation = Class 9–10; junior = Class 6–8).
ALTER TABLE players ADD COLUMN IF NOT EXISTS class TEXT;
ALTER TABLE results ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'neet';
CREATE INDEX IF NOT EXISTS results_board_track ON results(day, track, game, score DESC, seconds ASC);
-- One result per player, day, game AND track (a player who changes class can play the new track the same day).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'results_player_id_day_game_key') THEN
    ALTER TABLE results DROP CONSTRAINT results_player_id_day_game_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS results_player_day_game_track ON results(player_id, day, game, track);
