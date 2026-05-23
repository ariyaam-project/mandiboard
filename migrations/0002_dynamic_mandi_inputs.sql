ALTER TABLE mandi_sessions ADD COLUMN quarter_units INTEGER NOT NULL DEFAULT 4;
ALTER TABLE mandi_sessions ADD COLUMN mayo_units INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mandi_sessions ADD COLUMN soft_drinks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mandi_sessions ADD COLUMN soft_drink_type TEXT;
