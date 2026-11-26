-- Tarjima xizmatlari holati (qaysi manba ishlayapti)
CREATE TABLE IF NOT EXISTS lingo_tlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now','+5 hours')),
  provider TEXT NOT NULL,
  ok INTEGER NOT NULL,
  q TEXT,
  note TEXT
);
