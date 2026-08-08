-- 1. Allow member points to go negative (drop any check constraint)
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_puncte_check;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_puncte_nonneg;
ALTER TABLE members DROP CONSTRAINT IF EXISTS puncte_nonneg;

-- 2. Ensure task_log column exists as JSONB for persisting the activity log
ALTER TABLE members ADD COLUMN IF NOT EXISTS task_log jsonb DEFAULT '[]'::jsonb;

-- 3. Ensure any existing text/null values are safe to use as JSONB
UPDATE members SET task_log = '[]'::jsonb WHERE task_log IS NULL;
