-- Oktagon (1 ga 1 bellashuv) va Sovg'alar
CREATE TABLE IF NOT EXISTS lingo_duels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  week TEXT NOT NULL,
  opp_user INTEGER,            -- NULL = Zeehn bot
  opp_duel INTEGER,
  qs TEXT NOT NULL,            -- savollar (JSON)
  opp_ans TEXT NOT NULL,       -- raqib javoblari [{c,ms}] (JSON)
  answers TEXT,                -- o'quvchi javoblari [{c,ms}] (JSON)
  score INTEGER NOT NULL DEFAULT 0,
  opp_score INTEGER NOT NULL DEFAULT 0,
  result TEXT,                 -- win | lose | draw | NULL (tugamagan)
  coins INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+5 hours'))
);
CREATE INDEX IF NOT EXISTS lingo_duels_week ON lingo_duels(week, result);
CREATE INDEX IF NOT EXISTS lingo_duels_user ON lingo_duels(user_id, day);
CREATE TABLE IF NOT EXISTS lingo_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  gift TEXT NOT NULL,
  cost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',  -- new | done | cancel
  created_at TEXT NOT NULL DEFAULT (datetime('now','+5 hours'))
);
CREATE INDEX IF NOT EXISTS lingo_claims_user ON lingo_claims(user_id);
