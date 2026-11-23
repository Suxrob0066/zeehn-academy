-- Lingo: Dictionary & Translator — tarjima keshi va qidiruv hisobi
CREATE TABLE IF NOT EXISTS lingo_dict (
  word TEXT PRIMARY KEY,
  uz TEXT NOT NULL,
  phonetic TEXT,
  audio TEXT,
  pos TEXT,
  def TEXT,
  example TEXT,
  syn TEXT,
  src TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+5 hours'))
);
CREATE INDEX IF NOT EXISTS lingo_dict_uz ON lingo_dict(uz);
CREATE TABLE IF NOT EXISTS lingo_dq (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
