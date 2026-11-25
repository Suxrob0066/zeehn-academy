-- Do'st taklif qilish, do'st bilan Oktagon, nishonlar
ALTER TABLE lingo_users ADD COLUMN ref_code TEXT;
ALTER TABLE lingo_users ADD COLUMN ref_by INTEGER;
ALTER TABLE lingo_users ADD COLUMN ref_paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lingo_users ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0;
UPDATE lingo_users SET best_streak = streak;
CREATE UNIQUE INDEX IF NOT EXISTS lingo_users_ref ON lingo_users(ref_code);
CREATE INDEX IF NOT EXISTS lingo_users_refby ON lingo_users(ref_by);
ALTER TABLE lingo_duels ADD COLUMN token TEXT;
CREATE INDEX IF NOT EXISTS lingo_duels_token ON lingo_duels(token);
CREATE INDEX IF NOT EXISTS lingo_duels_oppduel ON lingo_duels(opp_duel);
