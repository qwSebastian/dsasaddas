-- Add archive columns to members table
-- Run in Supabase SQL Editor (project nghnpiundobkoxfixkum)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS archived      boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_status text,
  ADD COLUMN IF NOT EXISTS archived_at   timestamptz;

-- Index for fast GA archive queries
CREATE INDEX IF NOT EXISTS members_archived_idx ON public.members (archived) WHERE archived = true;
