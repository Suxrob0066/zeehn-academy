-- Lingo: foydalanuvchi profil rasmi (kichraytirilgan JPEG, base64)
ALTER TABLE lingo_users ADD COLUMN photo TEXT;
ALTER TABLE lingo_users ADD COLUMN photo_v INTEGER NOT NULL DEFAULT 0;
