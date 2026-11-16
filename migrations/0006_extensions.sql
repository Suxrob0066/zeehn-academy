CREATE TABLE IF NOT EXISTS extensions (
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  until TEXT NOT NULL,
  reason TEXT DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+5 hours')),
  PRIMARY KEY (assignment_id, student_id)
);
