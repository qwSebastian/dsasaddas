-- ══════════════════════════════════════════════════════════════
-- ALDRICK ENTERPRISES — FULL FRESH SETUP for a brand-new Supabase project
-- Run this ONCE in the SQL Editor of your NEW Supabase project.
-- Safe to re-run (idempotent) — but see the warning below.
--
-- ⚠ ORDER MATTERS. This file creates permissive starter policies on
--   `members` (INSERT/UPDATE/DELETE with `true`), which
--   20260706_session_tokens_hardening.sql then replaces with
--   authenticated-only ones. Re-running THIS file after the hardening
--   migration recreates the permissive policies and re-opens roster
--   writes to anyone holding the publishable key.
--   If you re-run this file, ALWAYS re-run the hardening file after it.
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Base tables ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  rank_system text DEFAULT 'default',
  list_type   text NOT NULL DEFAULT 'standard',   -- 'standard' | 'sala_sport'
  add_role    text NOT NULL DEFAULT 'general_admin', -- who can add members: 'general_admin' | 'admin2'
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
-- If the table already existed, make sure the new columns are present.
ALTER TABLE lists ADD COLUMN IF NOT EXISTS list_type  text NOT NULL DEFAULT 'standard';
ALTER TABLE lists ADD COLUMN IF NOT EXISTS add_role   text NOT NULL DEFAULT 'general_admin';
ALTER TABLE lists ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id        uuid REFERENCES lists(id) ON DELETE CASCADE,
  nume           text DEFAULT '',
  luni           text DEFAULT '',
  porecla        text DEFAULT '',
  cnp            text DEFAULT '',
  telefon        text DEFAULT '',
  inmatriculare  text DEFAULT '',
  rank           text,
  status         text DEFAULT 'Activ',
  task           text DEFAULT 'Neplatit',
  puncte         integer DEFAULT 0,
  photo          text,
  hs_driver      boolean DEFAULT false,
  pilot_heli     boolean DEFAULT false,
  pilot_avion    boolean DEFAULT false,
  barca          boolean DEFAULT false,
  concediu_start date,
  concediu_end   date,
  executive      boolean DEFAULT false,
  task_log       jsonb DEFAULT '[]'::jsonb,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE members ADD COLUMN IF NOT EXISTS concediu_start date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS concediu_end   date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS executive      boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS heists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  cover_photo text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS heist_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heist_id   uuid REFERENCES heists(id) ON DELETE CASCADE,
  photo      text,
  info       text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zone_info (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo       text,
  description text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zone_approvals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  status      text DEFAULT 'Neaprobat',
  weapon      text DEFAULT 'Fara Arma',
  approved_at timestamptz,
  logo        text,
  category    text DEFAULT 'oficiale',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS puncte_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category   text NOT NULL,
  label      text NOT NULL DEFAULT '',
  value      text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text UNIQUE NOT NULL,
  role       text NOT NULL CHECK (role IN ('general_admin', 'admin2')),
  nickname   text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text NOT NULL,
  action      text NOT NULL,
  details     text DEFAULT '',
  kind        text DEFAULT 'admin',   -- 'admin' | 'visit'
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS kind text DEFAULT 'admin';

-- accounts: unified nickname/password accounts with a role (admin2 or member)
CREATE TABLE IF NOT EXISTS accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('admin2', 'member')),
  created_at    timestamptz DEFAULT now()
);

-- ── Enable RLS on all tables ──────────────────────────────────
ALTER TABLE lists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_approvals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE heists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE heist_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_info       ENABLE ROW LEVEL SECURITY;
ALTER TABLE puncte_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts        ENABLE ROW LEVEL SECURITY;

-- ── Drop any pre-existing policies (safe if run more than once) ─
DROP POLICY IF EXISTS "lists_public_read"  ON lists;
DROP POLICY IF EXISTS "lists_auth_insert"  ON lists;
DROP POLICY IF EXISTS "lists_auth_update"  ON lists;
DROP POLICY IF EXISTS "lists_auth_delete"  ON lists;
DROP POLICY IF EXISTS "members_public_read" ON members;
DROP POLICY IF EXISTS "members_insert"      ON members;
DROP POLICY IF EXISTS "members_update"      ON members;
DROP POLICY IF EXISTS "members_delete"      ON members;
DROP POLICY IF EXISTS "members_auth_delete" ON members;
DROP POLICY IF EXISTS "zone_approvals_public_read"  ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_insert"  ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_update"  ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_delete"  ON zone_approvals;
DROP POLICY IF EXISTS "heists_public_read"  ON heists;
DROP POLICY IF EXISTS "heists_auth_insert"  ON heists;
DROP POLICY IF EXISTS "heists_auth_update"  ON heists;
DROP POLICY IF EXISTS "heists_auth_delete"  ON heists;
DROP POLICY IF EXISTS "heist_items_public_read"  ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_insert"  ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_update"  ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_delete"  ON heist_items;
DROP POLICY IF EXISTS "zone_info_public_read"  ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_insert"  ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_update"  ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_delete"  ON zone_info;
DROP POLICY IF EXISTS "puncte_rules_public_read"  ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_insert"  ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_update"  ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_delete"  ON puncte_rules;
DROP POLICY IF EXISTS "roles_read"  ON user_roles;
DROP POLICY IF EXISTS "roles_write" ON user_roles;
DROP POLICY IF EXISTS "logs_insert" ON admin_logs;
DROP POLICY IF EXISTS "logs_read"   ON admin_logs;
DROP POLICY IF EXISTS "admin2_accounts_deny_all" ON accounts;
DROP POLICY IF EXISTS "accounts_deny_all" ON accounts;

-- ── is_general_admin() helper (SECURITY DEFINER, no recursion) ─
CREATE OR REPLACE FUNCTION public.is_general_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
      AND role = 'general_admin'
  );
$$;

-- ── Policies: lists ───────────────────────────────────────────
-- SELECT public; INSERT/UPDATE/DELETE only General Admin (JWT).
CREATE POLICY "lists_public_read"  ON lists FOR SELECT USING (true);
CREATE POLICY "lists_auth_insert"  ON lists FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "lists_auth_update"  ON lists FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "lists_auth_delete"  ON lists FOR DELETE USING (auth.role() = 'authenticated');

-- ── Policies: members ─────────────────────────────────────────
-- SELECT public; INSERT/UPDATE/DELETE open to anon so Admin 2 (no JWT) can manage.
-- UI enforces per-role gating; General Admin also acts via JWT.
CREATE POLICY "members_public_read" ON members FOR SELECT USING (true);
CREATE POLICY "members_insert"      ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "members_update"      ON members FOR UPDATE USING (true);
CREATE POLICY "members_delete"      ON members FOR DELETE USING (true);

-- ── Policies: zone_approvals ──────────────────────────────────
CREATE POLICY "zone_approvals_public_read"  ON zone_approvals FOR SELECT USING (true);
CREATE POLICY "zone_approvals_auth_insert"  ON zone_approvals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "zone_approvals_auth_update"  ON zone_approvals FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "zone_approvals_auth_delete"  ON zone_approvals FOR DELETE USING (auth.role() = 'authenticated');

-- ── Policies: heists ──────────────────────────────────────────
CREATE POLICY "heists_public_read"  ON heists FOR SELECT USING (true);
CREATE POLICY "heists_auth_insert"  ON heists FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "heists_auth_update"  ON heists FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "heists_auth_delete"  ON heists FOR DELETE USING (auth.role() = 'authenticated');

-- ── Policies: heist_items ─────────────────────────────────────
CREATE POLICY "heist_items_public_read"  ON heist_items FOR SELECT USING (true);
CREATE POLICY "heist_items_auth_insert"  ON heist_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "heist_items_auth_update"  ON heist_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "heist_items_auth_delete"  ON heist_items FOR DELETE USING (auth.role() = 'authenticated');

-- ── Policies: zone_info ───────────────────────────────────────
CREATE POLICY "zone_info_public_read"  ON zone_info FOR SELECT USING (true);
CREATE POLICY "zone_info_auth_insert"  ON zone_info FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "zone_info_auth_update"  ON zone_info FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "zone_info_auth_delete"  ON zone_info FOR DELETE USING (auth.role() = 'authenticated');

-- ── Policies: puncte_rules ────────────────────────────────────
CREATE POLICY "puncte_rules_public_read"  ON puncte_rules FOR SELECT USING (true);
CREATE POLICY "puncte_rules_auth_insert"  ON puncte_rules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "puncte_rules_auth_update"  ON puncte_rules FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "puncte_rules_auth_delete"  ON puncte_rules FOR DELETE USING (auth.role() = 'authenticated');

-- ── Policies: user_roles ──────────────────────────────────────
CREATE POLICY "roles_read"  ON user_roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "roles_write" ON user_roles FOR ALL   USING (public.is_general_admin());

-- ── Policies: admin_logs ──────────────────────────────────────
-- INSERT open to anon (Admin 2 & visitor logging, no JWT).
-- SELECT public so Admin 2 (anon) can read logs + receive realtime inserts.
-- The UI gates who actually sees the logs view.
CREATE POLICY "logs_insert" ON admin_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "logs_read"   ON admin_logs FOR SELECT USING (true);

-- ── Policies: accounts ────────────────────────────────────────
-- No direct client access — all operations go through SECURITY DEFINER functions.
CREATE POLICY "accounts_deny_all" ON accounts USING (false);

-- ══════════════════════════════════════════════════════════════
-- SECURITY DEFINER functions for nickname/password accounts
-- ══════════════════════════════════════════════════════════════

-- Verify a nickname/password. Returns the role ('admin2'|'member') or '' if invalid.
CREATE OR REPLACE FUNCTION public.verify_account(p_nickname text, p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE v_hash text; v_role text;
BEGIN
  SELECT password_hash, role INTO v_hash, v_role
    FROM public.accounts WHERE nickname = p_nickname;
  IF NOT FOUND THEN RETURN ''; END IF;
  IF v_hash = extensions.crypt(p_password, v_hash) THEN RETURN v_role; END IF;
  RETURN '';
END;
$$;
REVOKE ALL ON FUNCTION public.verify_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_account(text, text) TO anon, authenticated;

-- General Admin creates any account (admin2 or member).
CREATE OR REPLACE FUNCTION public.create_account(p_nickname text, p_password text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_role NOT IN ('admin2', 'member') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  INSERT INTO public.accounts (nickname, password_hash, role)
    VALUES (p_nickname, extensions.crypt(p_password, extensions.gen_salt('bf')), p_role);
END;
$$;
REVOKE ALL ON FUNCTION public.create_account(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_account(text, text, text) TO authenticated;

-- Admin 2 (no JWT) creates a Member account, re-verified by their own credentials.
CREATE OR REPLACE FUNCTION public.admin2_create_member(
  p_admin_nickname text, p_admin_password text,
  p_new_nickname text, p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE v_hash text; v_role text;
BEGIN
  SELECT password_hash, role INTO v_hash, v_role
    FROM public.accounts WHERE nickname = p_admin_nickname;
  IF NOT FOUND OR v_role <> 'admin2' OR v_hash <> extensions.crypt(p_admin_password, v_hash) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  INSERT INTO public.accounts (nickname, password_hash, role)
    VALUES (p_new_nickname, extensions.crypt(p_new_password, extensions.gen_salt('bf')), 'member');
END;
$$;
REVOKE ALL ON FUNCTION public.admin2_create_member(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin2_create_member(text, text, text, text) TO anon, authenticated;

-- General Admin resets/changes the password for any account.
CREATE OR REPLACE FUNCTION public.reset_account_password(p_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF length(coalesce(p_new_password, '')) = 0 THEN RAISE EXCEPTION 'Password required'; END IF;
  UPDATE public.accounts
    SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
    WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_account_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_account_password(uuid, text) TO authenticated;

-- General Admin deletes any account.
CREATE OR REPLACE FUNCTION public.delete_account(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  DELETE FROM accounts WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_account(uuid) TO authenticated;

-- General Admin lists all accounts.
CREATE OR REPLACE FUNCTION public.list_accounts()
RETURNS TABLE (id uuid, nickname text, role text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY SELECT a.id, a.nickname, a.role, a.created_at
    FROM accounts a ORDER BY a.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_accounts() TO authenticated;

-- ── Replica identity (needed for realtime DELETE events) ──────
ALTER TABLE lists          REPLICA IDENTITY FULL;
ALTER TABLE members        REPLICA IDENTITY FULL;
ALTER TABLE zone_approvals REPLICA IDENTITY FULL;
ALTER TABLE heists         REPLICA IDENTITY FULL;
ALTER TABLE heist_items    REPLICA IDENTITY FULL;
ALTER TABLE zone_info      REPLICA IDENTITY FULL;
ALTER TABLE puncte_rules   REPLICA IDENTITY FULL;

-- ── Realtime publication ──────────────────────────────────────
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='lists')          THEN ALTER PUBLICATION supabase_realtime ADD TABLE lists;          END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='members')        THEN ALTER PUBLICATION supabase_realtime ADD TABLE members;        END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='zone_approvals') THEN ALTER PUBLICATION supabase_realtime ADD TABLE zone_approvals; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='heists')         THEN ALTER PUBLICATION supabase_realtime ADD TABLE heists;         END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='heist_items')    THEN ALTER PUBLICATION supabase_realtime ADD TABLE heist_items;    END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='zone_info')      THEN ALTER PUBLICATION supabase_realtime ADD TABLE zone_info;      END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='puncte_rules')   THEN ALTER PUBLICATION supabase_realtime ADD TABLE puncte_rules;   END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='user_roles')     THEN ALTER PUBLICATION supabase_realtime ADD TABLE user_roles;     END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='admin_logs')     THEN ALTER PUBLICATION supabase_realtime ADD TABLE admin_logs;     END IF; END $$;

-- ── Seed the three core lists ─────────────────────────────────
-- Sala Sport: gym roster. Admin 2+ can add members. No points/licențe/task.
--             Ranks: Personal Trainer / Supervizor / Manager Sala (lowest →
--             highest). Supports Executive + concediu.
-- Aldrick Family & Sicarios: full rosters. Only General Admin can add members.
INSERT INTO lists (name, rank_system, list_type, add_role, sort_order)
SELECT name, rank_system, list_type, add_role, sort_order FROM (VALUES
  ('Sala Sport',     'sala_sport','sala_sport','admin2',       1),
  ('Aldrick Family', 'default',  'standard', 'general_admin', 2),
  ('Sicarios',       'vendettas','standard', 'general_admin', 3)
) AS t(name, rank_system, list_type, add_role, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM lists LIMIT 1);

-- ── Seed puncte_rules (skipped if data already exists) ────────
INSERT INTO puncte_rules (category, label, value, sort_order)
SELECT category, label, value, sort_order FROM (VALUES
  ('puncte_mobs','Jaf Exchange / Biju / Rapire câștigate','10 puncte',1),
  ('puncte_mobs','Jaf Exchange / Biju / Rapire pierdute','5 puncte',2),
  ('puncte_mobs','Patrulă','2 puncte',3),
  ('puncte_mobs','Mineriada','5 puncte',4),
  ('puncte_mobs','Adus Hacking Device','2 puncte',5),
  ('puncte_mobs','Donații pentru Vendetta''s (puncte în funcție de ce aduceți)','',6),
  ('ajutor_vendettas','100 meta livrat','2 puncte + 25% din bani',1),
  ('ajutor_vendettas','200 meta livrat','4 puncte + 25% din bani',2),
  ('ajutor_vendettas','Ținut la livrat om mare','2 puncte',3),
  ('regulament','Ca să puteți fi eligibili pentru up, va trebui să adunați un total de 50 puncte + participare obligatorie la un jaf și la o mineriada!','',1),
  ('regulament','În caz că veți face dublul punctelor, veți primi double up.','',2),
  ('regulament','În caz că veți face triplul punctelor, nu veți primi triple up, ci se va ține cont pentru săptămâna următoare!','',3),
  ('regulament','Ultimul grad, adică Half V, ca să-și mențină gradul, va trebui să adune un minim de 20 puncte pe săptămână!','',4),
  ('regulament','Half V vă pot da și ei puncte, adică vă pot pune la treabă!','',5),
  ('regulament','Ca să vă mențineți gradul pe care îl aveți, va trebui să adunați un minim de 25 puncte pe săptămână!','',6),
  ('half_v_reguli','Toate licențele: HS, Pilot Heli (altele nu mă interesează)!','',1),
  ('half_v_reguli','Runflat pe minim 2 mașini: una pe LS, una pe Cayo!','',2),
  ('half_v_reguli','Minim 5.000.000 cash, în bancă sau împachetați!','',3),
  ('half_v_reguli','Să cunoști tot orașul!','',4),
  ('half_v_reguli','Să știi să conduci!','',5)
) AS t(category, label, value, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM puncte_rules LIMIT 1);

-- ══════════════════════════════════════════════════════════════
-- General Admin account
-- Change the email below to YOUR Supabase Auth account email
-- (the one you'll use to sign in as General Admin), then run.
-- ══════════════════════════════════════════════════════════════
INSERT INTO user_roles (email, role)
VALUES ('cristeasebastian1000@yahoo.com', 'general_admin')
ON CONFLICT (email) DO UPDATE SET role = 'general_admin';
