-- ============================================================
-- RLS for all core tables
-- Run this once in your Supabase SQL Editor.
-- Pattern: everyone can READ, only authenticated (admin) can WRITE.
-- ============================================================

-- ── lists ────────────────────────────────────────────────────
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lists_public_read"  ON lists;
DROP POLICY IF EXISTS "lists_auth_insert"  ON lists;
DROP POLICY IF EXISTS "lists_auth_update"  ON lists;
DROP POLICY IF EXISTS "lists_auth_delete"  ON lists;

CREATE POLICY "lists_public_read"  ON lists FOR SELECT USING (true);
CREATE POLICY "lists_auth_insert"  ON lists FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "lists_auth_update"  ON lists FOR UPDATE USING     (auth.role() = 'authenticated');
CREATE POLICY "lists_auth_delete"  ON lists FOR DELETE USING     (auth.role() = 'authenticated');

-- ── members ──────────────────────────────────────────────────
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_public_read"  ON members;
DROP POLICY IF EXISTS "members_auth_insert"  ON members;
DROP POLICY IF EXISTS "members_auth_update"  ON members;
DROP POLICY IF EXISTS "members_auth_delete"  ON members;

CREATE POLICY "members_public_read"  ON members FOR SELECT USING (true);
CREATE POLICY "members_auth_insert"  ON members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "members_auth_update"  ON members FOR UPDATE USING     (auth.role() = 'authenticated');
CREATE POLICY "members_auth_delete"  ON members FOR DELETE USING     (auth.role() = 'authenticated');

-- ── zone_approvals ───────────────────────────────────────────
ALTER TABLE zone_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zone_approvals_public_read"  ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_insert"  ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_update"  ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_delete"  ON zone_approvals;

CREATE POLICY "zone_approvals_public_read"  ON zone_approvals FOR SELECT USING (true);
CREATE POLICY "zone_approvals_auth_insert"  ON zone_approvals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "zone_approvals_auth_update"  ON zone_approvals FOR UPDATE USING     (auth.role() = 'authenticated');
CREATE POLICY "zone_approvals_auth_delete"  ON zone_approvals FOR DELETE USING     (auth.role() = 'authenticated');

-- ── heist_items ──────────────────────────────────────────────
ALTER TABLE heist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "heist_items_public_read"  ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_insert"  ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_update"  ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_delete"  ON heist_items;

CREATE POLICY "heist_items_public_read"  ON heist_items FOR SELECT USING (true);
CREATE POLICY "heist_items_auth_insert"  ON heist_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "heist_items_auth_update"  ON heist_items FOR UPDATE USING     (auth.role() = 'authenticated');
CREATE POLICY "heist_items_auth_delete"  ON heist_items FOR DELETE USING     (auth.role() = 'authenticated');

-- ── zone_items ───────────────────────────────────────────────
ALTER TABLE zone_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zone_items_public_read"  ON zone_items;
DROP POLICY IF EXISTS "zone_items_auth_insert"  ON zone_items;
DROP POLICY IF EXISTS "zone_items_auth_update"  ON zone_items;
DROP POLICY IF EXISTS "zone_items_auth_delete"  ON zone_items;

CREATE POLICY "zone_items_public_read"  ON zone_items FOR SELECT USING (true);
CREATE POLICY "zone_items_auth_insert"  ON zone_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "zone_items_auth_update"  ON zone_items FOR UPDATE USING     (auth.role() = 'authenticated');
CREATE POLICY "zone_items_auth_delete"  ON zone_items FOR DELETE USING     (auth.role() = 'authenticated');

-- ── puncte_rules (already set, kept idempotent) ──────────────
ALTER TABLE puncte_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_puncte_rules" ON puncte_rules;
DROP POLICY IF EXISTS "auth_write_puncte_rules"  ON puncte_rules;
DROP POLICY IF EXISTS "Allow public read"          ON puncte_rules;
DROP POLICY IF EXISTS "Allow authenticated insert" ON puncte_rules;
DROP POLICY IF EXISTS "Allow authenticated update" ON puncte_rules;
DROP POLICY IF EXISTS "Allow authenticated delete" ON puncte_rules;

CREATE POLICY "puncte_rules_public_read"  ON puncte_rules FOR SELECT USING (true);
CREATE POLICY "puncte_rules_auth_insert"  ON puncte_rules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "puncte_rules_auth_update"  ON puncte_rules FOR UPDATE USING     (auth.role() = 'authenticated');
CREATE POLICY "puncte_rules_auth_delete"  ON puncte_rules FOR DELETE USING     (auth.role() = 'authenticated');

-- ── REPLICA IDENTITY FULL (needed for realtime DELETE to include full old row) ─
ALTER TABLE lists          REPLICA IDENTITY FULL;
ALTER TABLE members        REPLICA IDENTITY FULL;
ALTER TABLE zone_approvals REPLICA IDENTITY FULL;
ALTER TABLE heists         REPLICA IDENTITY FULL;
ALTER TABLE heist_items    REPLICA IDENTITY FULL;
ALTER TABLE zone_info      REPLICA IDENTITY FULL;
ALTER TABLE puncte_rules   REPLICA IDENTITY FULL;

-- ── Realtime publication ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='lists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lists; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE members; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='zone_approvals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE zone_approvals; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='heists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE heists; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='heist_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE heist_items; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='zone_info') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE zone_info; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='puncte_rules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE puncte_rules; END IF; END $$;
