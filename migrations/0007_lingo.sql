-- Zeehn Lingo — til o'rganish platformasi (alohida foydalanuvchilar)
CREATE TABLE IF NOT EXISTS lingo_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pass TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+5 hours'))
);
CREATE TABLE IF NOT EXISTS lingo_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lingo_done (
  user_id INTEGER NOT NULL,
  lesson TEXT NOT NULL,
  best INTEGER NOT NULL DEFAULT 0,
  times INTEGER NOT NULL DEFAULT 1,
  first_at TEXT NOT NULL DEFAULT (datetime('now','+5 hours')),
  PRIMARY KEY (user_id, lesson)
);
CREATE TABLE IF NOT EXISTS lingo_chests (
  user_id INTEGER NOT NULL,
  unit TEXT NOT NULL,
  PRIMARY KEY (user_id, unit)
);
CREATE TABLE IF NOT EXISTS lingo_words (
  user_id INTEGER NOT NULL,
  word TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1,
  due TEXT NOT NULL,
  PRIMARY KEY (user_id, word)
);
CREATE TABLE IF NOT EXISTS lingo_xp (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS lingo_xp_day ON lingo_xp(day);
CREATE TABLE IF NOT EXISTS lingo_ai (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
