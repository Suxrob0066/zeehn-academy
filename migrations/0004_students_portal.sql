ALTER TABLE students ADD COLUMN login TEXT;
ALTER TABLE students ADD COLUMN pass TEXT;
ALTER TABLE students ADD COLUMN photo TEXT DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_login ON students(login COLLATE NOCASE) WHERE login IS NOT NULL;
ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'user';
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  teacher_id INTEGER,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  link TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  max_score INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+5 hours'))
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  text TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now','+5 hours')),
  score INTEGER,
  feedback TEXT DEFAULT '',
  checked_at TEXT,
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_asg_group ON assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_sub_asg ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_sub_student ON submissions(student_id);
