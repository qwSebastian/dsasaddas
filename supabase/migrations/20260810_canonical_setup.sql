-- ══════════════════════════════════════════════════════════════════════
-- ALDRICK ENTERPRISES — CANONICAL DATABASE SETUP
--
-- This single file replaces every earlier script. Run it on the existing
-- project or on a brand-new one; it reaches the same end state either way.
--
--   • Idempotent — safe to run as many times as you like.
--   • Non-destructive — never drops a table or deletes roster data.
--   • Self-repairing — resets every policy and grant to the intended
--     state, so a half-run old script can't leave the database open.
--
-- Replaces: the old "EVIDENȚĂ" setup, 20260706_fresh_project_full_setup,
-- 20260706_session_tokens_hardening, 20260810_lock_down_rpcs_and_policies,
-- the archive/sort_order/card_bg patches, and the Sala Sport rename.
--
-- HOW TO RUN: clear the SQL editor tab completely (Ctrl+A, Delete), paste
-- this whole file, run once. Never paste anything below it — leftovers are
-- what caused the drift in the first place.
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ══════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- CREATE IF NOT EXISTS keeps existing data; the ALTERs add every column
-- introduced by a later patch, so an old database catches up in place.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  rank_system text DEFAULT 'default',
  list_type   text NOT NULL DEFAULT 'standard',      -- 'standard' | 'sala_sport'
  add_role    text NOT NULL DEFAULT 'general_admin', -- 'general_admin' | 'admin2'
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
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
  card_bg        boolean DEFAULT false,
  archived       boolean DEFAULT false,
  archive_status text,
  archived_at    timestamptz,
  sort_order     integer DEFAULT 0,
  task_log       jsonb DEFAULT '[]'::jsonb,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE members ADD COLUMN IF NOT EXISTS concediu_start date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS concediu_end   date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS executive      boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS card_bg        boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS archived       boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS archive_status text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS archived_at    timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS sort_order     integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS members_archived_idx ON members (archived) WHERE archived = true;
CREATE INDEX IF NOT EXISTS members_list_id_idx  ON members (list_id);

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
  kind        text DEFAULT 'admin',   -- 'admin' | 'auth' | 'visit'
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS kind text DEFAULT 'admin';
CREATE INDEX IF NOT EXISTS admin_logs_created_at_idx ON admin_logs (created_at DESC);

-- Nickname/password accounts: Admin 2 and Member.
CREATE TABLE IF NOT EXISTS accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('admin2', 'member')),
  created_at    timestamptz DEFAULT now()
);

-- Server-issued session tokens for those accounts (they hold no JWT).
CREATE TABLE IF NOT EXISTS account_sessions (
  token      text PRIMARY KEY,
  nickname   text NOT NULL,
  role       text NOT NULL CHECK (role IN ('admin2', 'member')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- ══════════════════════════════════════════════════════════════════════
-- 2. ROW LEVEL SECURITY — enable everywhere
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE lists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE heists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE heist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_info        ENABLE ROW LEVEL SECURITY;
ALTER TABLE puncte_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_sessions ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════
-- 3. DROP EVERY POLICY THIS PROJECT HAS EVER CREATED
--
-- Permissive policies are OR'd together, so one stale `USING (true)` left
-- beside a strict policy reopens the table completely. Every historical
-- name is dropped here before anything is recreated.
-- ══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "lists_public_read"  ON lists;
DROP POLICY IF EXISTS "lists_auth_insert"  ON lists;
DROP POLICY IF EXISTS "lists_auth_update"  ON lists;
DROP POLICY IF EXISTS "lists_auth_delete"  ON lists;

DROP POLICY IF EXISTS "members_public_read" ON members;
DROP POLICY IF EXISTS "members_insert"      ON members;   -- legacy, USING (true)
DROP POLICY IF EXISTS "members_update"      ON members;   -- legacy, USING (true)
DROP POLICY IF EXISTS "members_delete"      ON members;   -- legacy, USING (true)
DROP POLICY IF EXISTS "members_auth_insert" ON members;
DROP POLICY IF EXISTS "members_auth_update" ON members;
DROP POLICY IF EXISTS "members_auth_delete" ON members;

DROP POLICY IF EXISTS "zone_approvals_public_read" ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_insert" ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_update" ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_delete" ON zone_approvals;

DROP POLICY IF EXISTS "heists_public_read" ON heists;
DROP POLICY IF EXISTS "heists_auth_insert" ON heists;
DROP POLICY IF EXISTS "heists_auth_update" ON heists;
DROP POLICY IF EXISTS "heists_auth_delete" ON heists;

DROP POLICY IF EXISTS "heist_items_public_read" ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_insert" ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_update" ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_delete" ON heist_items;

DROP POLICY IF EXISTS "zone_info_public_read" ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_insert" ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_update" ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_delete" ON zone_info;

DROP POLICY IF EXISTS "puncte_rules_public_read" ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_insert" ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_update" ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_delete" ON puncte_rules;

DROP POLICY IF EXISTS "roles_read"  ON user_roles;
DROP POLICY IF EXISTS "roles_write" ON user_roles;

DROP POLICY IF EXISTS "logs_insert" ON admin_logs;
DROP POLICY IF EXISTS "logs_read"   ON admin_logs;

DROP POLICY IF EXISTS "accounts_deny_all"         ON accounts;
DROP POLICY IF EXISTS "admin2_accounts_deny_all"  ON accounts;
DROP POLICY IF EXISTS "account_sessions_deny_all" ON account_sessions;

-- ══════════════════════════════════════════════════════════════════════
-- 4. HELPER
-- SECURITY DEFINER so it can read user_roles without recursing through
-- that table's own policies.
-- ══════════════════════════════════════════════════════════════════════

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
-- Left executable by everyone on purpose: it returns false for anon, and
-- RLS policies below call it, which requires the querying role to hold
-- EXECUTE. Revoking it breaks ordinary reads.
GRANT EXECUTE ON FUNCTION public.is_general_admin() TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 5. POLICIES
--
-- The rule throughout: public can READ what the site displays; only a
-- signed-in General Admin can WRITE. Admin 2 has no JWT and never writes
-- through the tables — it goes through the token-checked functions in
-- section 6, which bypass RLS after verifying the session.
-- ══════════════════════════════════════════════════════════════════════

-- Roster and reference data: world-readable, GA-writable.
CREATE POLICY "lists_public_read" ON lists FOR SELECT USING (true);
CREATE POLICY "lists_auth_insert" ON lists FOR INSERT TO authenticated WITH CHECK (public.is_general_admin());
CREATE POLICY "lists_auth_update" ON lists FOR UPDATE TO authenticated USING      (public.is_general_admin());
CREATE POLICY "lists_auth_delete" ON lists FOR DELETE TO authenticated USING      (public.is_general_admin());

CREATE POLICY "members_public_read" ON members FOR SELECT USING (true);
CREATE POLICY "members_auth_insert" ON members FOR INSERT TO authenticated WITH CHECK (public.is_general_admin());
CREATE POLICY "members_auth_update" ON members FOR UPDATE TO authenticated USING      (public.is_general_admin());
CREATE POLICY "members_auth_delete" ON members FOR DELETE TO authenticated USING      (public.is_general_admin());

CREATE POLICY "zone_approvals_public_read" ON zone_approvals FOR SELECT USING (true);
CREATE POLICY "zone_approvals_auth_insert" ON zone_approvals FOR INSERT TO authenticated WITH CHECK (public.is_general_admin());
CREATE POLICY "zone_approvals_auth_update" ON zone_approvals FOR UPDATE TO authenticated USING      (public.is_general_admin());
CREATE POLICY "zone_approvals_auth_delete" ON zone_approvals FOR DELETE TO authenticated USING      (public.is_general_admin());

CREATE POLICY "heists_public_read" ON heists FOR SELECT USING (true);
CREATE POLICY "heists_auth_insert" ON heists FOR INSERT TO authenticated WITH CHECK (public.is_general_admin());
CREATE POLICY "heists_auth_update" ON heists FOR UPDATE TO authenticated USING      (public.is_general_admin());
CREATE POLICY "heists_auth_delete" ON heists FOR DELETE TO authenticated USING      (public.is_general_admin());

CREATE POLICY "heist_items_public_read" ON heist_items FOR SELECT USING (true);
CREATE POLICY "heist_items_auth_insert" ON heist_items FOR INSERT TO authenticated WITH CHECK (public.is_general_admin());
CREATE POLICY "heist_items_auth_update" ON heist_items FOR UPDATE TO authenticated USING      (public.is_general_admin());
CREATE POLICY "heist_items_auth_delete" ON heist_items FOR DELETE TO authenticated USING      (public.is_general_admin());

CREATE POLICY "zone_info_public_read" ON zone_info FOR SELECT USING (true);
CREATE POLICY "zone_info_auth_insert" ON zone_info FOR INSERT TO authenticated WITH CHECK (public.is_general_admin());
CREATE POLICY "zone_info_auth_update" ON zone_info FOR UPDATE TO authenticated USING      (public.is_general_admin());
CREATE POLICY "zone_info_auth_delete" ON zone_info FOR DELETE TO authenticated USING      (public.is_general_admin());

CREATE POLICY "puncte_rules_public_read" ON puncte_rules FOR SELECT USING (true);
CREATE POLICY "puncte_rules_auth_insert" ON puncte_rules FOR INSERT TO authenticated WITH CHECK (public.is_general_admin());
CREATE POLICY "puncte_rules_auth_update" ON puncte_rules FOR UPDATE TO authenticated USING      (public.is_general_admin());
CREATE POLICY "puncte_rules_auth_delete" ON puncte_rules FOR DELETE TO authenticated USING      (public.is_general_admin());

-- Roles: any signed-in user may read (the app resolves its own role on
-- login); only a General Admin may change them.
CREATE POLICY "roles_read"  ON user_roles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "roles_write" ON user_roles FOR ALL    TO authenticated USING (public.is_general_admin()) WITH CHECK (public.is_general_admin());

-- Journal: General Admin reads it. INSERT stays open because visitors and
-- Admin 2 have no JWT and still need to record entries; Admin 2 reads
-- through sess_list_logs(). The trade-off is that a key holder can write
-- junk rows — they cannot read, edit or delete anything.
CREATE POLICY "logs_insert" ON admin_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "logs_read"   ON admin_logs FOR SELECT TO authenticated USING (public.is_general_admin());

-- Credentials and sessions: no direct client access at all, ever.
CREATE POLICY "accounts_deny_all"         ON accounts         USING (false);
CREATE POLICY "account_sessions_deny_all" ON account_sessions USING (false);

-- The retired admin2_accounts table, if this database still has one.
DO $$
BEGIN
  IF to_regclass('public.admin2_accounts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.admin2_accounts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "admin2_accounts_deny_all" ON public.admin2_accounts';
    EXECUTE 'CREATE POLICY "admin2_accounts_deny_all" ON public.admin2_accounts USING (false)';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- 6. FUNCTIONS
--
-- Grant rules:
--   anon + authenticated — must work before a session exists, and each
--     verifies a password or a session token itself.
--   authenticated only   — General Admin operations, additionally gated
--     by is_general_admin() inside the body.
-- ══════════════════════════════════════════════════════════════════════

-- ── Sessions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.session_role(p_token text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.account_sessions
  WHERE token = p_token AND expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.session_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_role(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.login_account(p_nickname text, p_password text)
RETURNS TABLE (role text, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE v_hash text; v_role text; v_token text;
BEGIN
  SELECT password_hash, accounts.role INTO v_hash, v_role
    FROM public.accounts WHERE nickname = p_nickname;
  IF NOT FOUND OR v_hash <> extensions.crypt(p_password, v_hash) THEN
    RETURN;  -- empty result => invalid credentials
  END IF;
  DELETE FROM public.account_sessions WHERE expires_at < now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.account_sessions (token, nickname, role, expires_at)
    VALUES (v_token, p_nickname, v_role, now() + interval '12 hours');
  RETURN QUERY SELECT v_role, v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.login_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_account(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.logout_account(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.account_sessions WHERE token = p_token;
$$;
REVOKE ALL ON FUNCTION public.logout_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.logout_account(text) TO anon, authenticated;

-- ── Admin 2 roster writes, gated on the session token ─────────────────

CREATE OR REPLACE FUNCTION public.sess_member_insert(p_token text, p_list_id uuid, p_rank text)
RETURNS members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text; v_add_role text; v_row members;
BEGIN
  v_role := public.session_role(p_token);
  -- IS DISTINCT FROM, not <>. session_role() returns NULL for an unknown or
  -- expired token, and `NULL <> 'admin2'` evaluates to NULL, which plpgsql
  -- treats as false — so a made-up token skipped this guard entirely.
  IF v_role IS DISTINCT FROM 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT add_role INTO v_add_role FROM lists WHERE id = p_list_id;
  IF NOT FOUND OR v_add_role IS DISTINCT FROM 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  INSERT INTO members (list_id, nume, luni, porecla, cnp, telefon, inmatriculare,
                       rank, status, task, puncte, photo, executive)
    VALUES (p_list_id, '', '', '', '', '', '', p_rank, 'Activ', 'Neplatit', 0, NULL, false)
    RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.sess_member_insert(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sess_member_insert(text, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sess_member_update(p_token text, p_id uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.session_role(p_token);
  -- IS DISTINCT FROM, not <>. session_role() returns NULL for an unknown or
  -- expired token, and `NULL <> 'admin2'` evaluates to NULL, which plpgsql
  -- treats as false — so a made-up token skipped this guard entirely.
  IF v_role IS DISTINCT FROM 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  UPDATE members SET
    nume           = CASE WHEN p_data ? 'nume'           THEN p_data->>'nume'                     ELSE nume END,
    luni           = CASE WHEN p_data ? 'luni'           THEN p_data->>'luni'                     ELSE luni END,
    porecla        = CASE WHEN p_data ? 'porecla'        THEN p_data->>'porecla'                  ELSE porecla END,
    cnp            = CASE WHEN p_data ? 'cnp'            THEN p_data->>'cnp'                      ELSE cnp END,
    telefon        = CASE WHEN p_data ? 'telefon'        THEN p_data->>'telefon'                  ELSE telefon END,
    inmatriculare  = CASE WHEN p_data ? 'inmatriculare'  THEN p_data->>'inmatriculare'            ELSE inmatriculare END,
    rank           = CASE WHEN p_data ? 'rank'           THEN p_data->>'rank'                     ELSE rank END,
    status         = CASE WHEN p_data ? 'status'         THEN p_data->>'status'                   ELSE status END,
    task           = CASE WHEN p_data ? 'task'           THEN p_data->>'task'                     ELSE task END,
    puncte         = CASE WHEN p_data ? 'puncte'         THEN (p_data->>'puncte')::integer        ELSE puncte END,
    photo          = CASE WHEN p_data ? 'photo'          THEN p_data->>'photo'                    ELSE photo END,
    hs_driver      = CASE WHEN p_data ? 'hs_driver'      THEN (p_data->>'hs_driver')::boolean     ELSE hs_driver END,
    pilot_heli     = CASE WHEN p_data ? 'pilot_heli'     THEN (p_data->>'pilot_heli')::boolean    ELSE pilot_heli END,
    pilot_avion    = CASE WHEN p_data ? 'pilot_avion'    THEN (p_data->>'pilot_avion')::boolean   ELSE pilot_avion END,
    barca          = CASE WHEN p_data ? 'barca'          THEN (p_data->>'barca')::boolean         ELSE barca END,
    concediu_start = CASE WHEN p_data ? 'concediu_start' THEN (p_data->>'concediu_start')::date   ELSE concediu_start END,
    concediu_end   = CASE WHEN p_data ? 'concediu_end'   THEN (p_data->>'concediu_end')::date     ELSE concediu_end END,
    executive      = CASE WHEN p_data ? 'executive'      THEN (p_data->>'executive')::boolean     ELSE executive END,
    card_bg        = CASE WHEN p_data ? 'card_bg'        THEN (p_data->>'card_bg')::boolean       ELSE card_bg END,
    task_log       = CASE WHEN p_data ? 'task_log'       THEN p_data->'task_log'                  ELSE task_log END
  WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.sess_member_update(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sess_member_update(text, uuid, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sess_member_delete(p_token text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.session_role(p_token);
  -- IS DISTINCT FROM, not <>. session_role() returns NULL for an unknown or
  -- expired token, and `NULL <> 'admin2'` evaluates to NULL, which plpgsql
  -- treats as false — so a made-up token skipped this guard entirely.
  IF v_role IS DISTINCT FROM 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  DELETE FROM members WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.sess_member_delete(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sess_member_delete(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sess_list_logs(p_token text)
RETURNS SETOF admin_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.session_role(p_token);
  -- IS DISTINCT FROM, not <>. session_role() returns NULL for an unknown or
  -- expired token, and `NULL <> 'admin2'` evaluates to NULL, which plpgsql
  -- treats as false — so a made-up token skipped this guard entirely.
  IF v_role IS DISTINCT FROM 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION public.sess_list_logs(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sess_list_logs(text) TO anon, authenticated;

-- ── Account management ────────────────────────────────────────────────

-- Admin 2 creates a Member account, re-proving its own password first.
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
REVOKE ALL ON FUNCTION public.create_account(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_account(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_account(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_nickname text;
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  DELETE FROM accounts WHERE id = p_id RETURNING nickname INTO v_nickname;
  -- Kill any live session, or a deleted account keeps working for 12h.
  IF v_nickname IS NOT NULL THEN
    DELETE FROM public.account_sessions WHERE nickname = v_nickname;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_account(uuid) TO authenticated;

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
REVOKE ALL ON FUNCTION public.list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_account_password(p_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE v_nickname text;
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF length(coalesce(p_new_password, '')) = 0 THEN RAISE EXCEPTION 'Password required'; END IF;
  UPDATE public.accounts
     SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
   WHERE id = p_id
   RETURNING nickname INTO v_nickname;
  -- Force a re-login, so the old password can't ride an open session.
  IF v_nickname IS NOT NULL THEN
    DELETE FROM public.account_sessions WHERE nickname = v_nickname;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_account_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_account_password(uuid, text) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 7. RETIRED FUNCTIONS
-- From the original admin2_accounts model. Nothing in the app calls them;
-- they only widen the surface and clutter the Security Advisor.
-- ══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.verify_admin2(text, text);
DROP FUNCTION IF EXISTS public.create_admin2_account(text, text);
DROP FUNCTION IF EXISTS public.delete_admin2_account(uuid);
DROP FUNCTION IF EXISTS public.list_admin2_accounts();
DROP FUNCTION IF EXISTS public.verify_account(text, text);

-- The admin2_accounts TABLE is deliberately left in place — dropping it
-- would delete credentials with no way back. It is locked to deny-all
-- above, so nothing can reach it. Once you have confirmed it is empty or
-- no longer wanted, run:  DROP TABLE public.admin2_accounts;

-- ══════════════════════════════════════════════════════════════════════
-- 8. REALTIME
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE lists          REPLICA IDENTITY FULL;
ALTER TABLE members        REPLICA IDENTITY FULL;
ALTER TABLE zone_approvals REPLICA IDENTITY FULL;
ALTER TABLE heists         REPLICA IDENTITY FULL;
ALTER TABLE heist_items    REPLICA IDENTITY FULL;
ALTER TABLE zone_info      REPLICA IDENTITY FULL;
ALTER TABLE puncte_rules   REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lists','members','zone_approvals','heists','heist_items',
                           'zone_info','puncte_rules','user_roles','admin_logs']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- 9. SEED DATA — only ever inserted into an empty table
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO lists (name, rank_system, list_type, add_role, sort_order)
SELECT name, rank_system, list_type, add_role, sort_order FROM (VALUES
  ('Sala Sport',     'sala_sport', 'sala_sport', 'admin2',        1),
  ('Aldrick Family', 'default',    'standard',   'general_admin', 2),
  ('Sicarios',       'vendettas',  'standard',   'general_admin', 3)
) AS t(name, rank_system, list_type, add_role, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM lists LIMIT 1);

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

-- ══════════════════════════════════════════════════════════════════════
-- 10. FRIZERIE → SALA SPORT
-- No-op once applied.
-- ══════════════════════════════════════════════════════════════════════

UPDATE members m
   SET rank = CASE m.rank
                WHEN 'Frizer'      THEN 'Personal Trainer'
                WHEN 'Hairstylist' THEN 'Supervizor'
                WHEN 'Manager'     THEN 'Manager Sala'
                ELSE 'Personal Trainer'
              END
  FROM lists l
 WHERE m.list_id = l.id
   AND (l.list_type = 'frizerie' OR l.rank_system = 'frizerie')
   AND (m.rank IS NULL OR m.rank NOT IN ('Personal Trainer', 'Supervizor', 'Manager Sala'));

UPDATE lists
   SET name        = CASE WHEN name = 'Frizerie' THEN 'Sala Sport' ELSE name END,
       rank_system = 'sala_sport',
       list_type   = 'sala_sport'
 WHERE list_type = 'frizerie' OR rank_system = 'frizerie';

-- ══════════════════════════════════════════════════════════════════════
-- 11. GENERAL ADMINS
--
-- Each needs BOTH a confirmed user in Authentication → Users AND a row
-- here. Creating the Auth user cannot be done in SQL — do that in the
-- dashboard with "Auto Confirm User" ticked, then run this file.
--
-- To add someone later, add a line and re-run. To remove access, delete
-- their row (that revokes admin rights but leaves the login intact).
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO user_roles (email, role, nickname) VALUES
  ('cristeasebastian1000@yahoo.com', 'general_admin', 'Sebastian'),
  ('vlad.otelea280@gmail.com',       'general_admin', 'Vlad'),
  ('pozzangiovanni111@gmail.com',    'general_admin', 'Giovanni'),
  ('smarin2006@yahoo.com',           'general_admin', 'Smarin'),
  ('fplaytstaff@yahoo.com',          'general_admin', 'FPlayT')
ON CONFLICT (email) DO UPDATE
  SET role     = 'general_admin',
      nickname = COALESCE(EXCLUDED.nickname, user_roles.nickname);

-- Stale row: granted to an address with no login behind it.
DELETE FROM user_roles WHERE email = 's.marin2006@yahoo.com';

-- Make sure every granted address can actually sign in. An unconfirmed
-- address is rejected at login and looks exactly like a wrong password.
UPDATE auth.users
   SET email_confirmed_at = coalesce(email_confirmed_at, now())
 WHERE lower(email) IN (SELECT lower(email) FROM user_roles);

COMMIT;

-- ══════════════════════════════════════════════════════════════════════
-- VERIFY — run these after, they are read-only
-- ══════════════════════════════════════════════════════════════════════

-- Every admin, and whether they can actually log in.
SELECT r.email, r.role, r.nickname,
       (u.id IS NOT NULL)     AS has_login,
       u.email_confirmed_at,
       u.last_sign_in_at
  FROM user_roles r
  LEFT JOIN auth.users u ON lower(u.email) = lower(r.email)
 ORDER BY r.email;

-- No policy should read `true` except the public SELECTs and logs_insert.
SELECT tablename, policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, cmd, policyname;

-- anon should only reach login/logout, the sess_* wrappers,
-- admin2_create_member and is_general_admin.
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_call
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
 ORDER BY anon_can_call DESC, p.proname;
