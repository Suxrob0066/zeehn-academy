-- Bugungi so'z kartochkalari va haftalik ligalar
ALTER TABLE lingo_words ADD COLUMN added TEXT;
CREATE TABLE IF NOT EXISTS lingo_cards_day (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS lingo_league (
  user_id INTEGER PRIMARY KEY,
  tier INTEGER NOT NULL DEFAULT 0,
  week TEXT,
  last_move TEXT,
  last_tier INTEGER,
  seen INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS lingo_lgm (
  week TEXT NOT NULL,
  tier INTEGER NOT NULL,
  grp INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (week, user_id)
);
CREATE INDEX IF NOT EXISTS lingo_lgm_grp ON lingo_lgm(week, tier, grp);
CREATE INDEX IF NOT EXISTS lingo_lgm_user ON lingo_lgm(user_id, week);
