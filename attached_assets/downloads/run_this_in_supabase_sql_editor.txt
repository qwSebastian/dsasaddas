-- ══════════════════════════════════════════════════════════════
-- ALDRICK ENTERPRISES — Session-token hardening
-- Run this AFTER 20260706_fresh_project_full_setup.sql in the
-- Supabase SQL Editor (project nghnpiundobkoxfixkum).
-- Safe to re-run (idempotent).
--
-- What this does:
--   * Gives nickname accounts (admin2/member) a server-issued,
--     short-lived session token on login.
--   * Locks down the `members` table so anon can no longer write
--     directly. Writes now go through token-validated RPCs (admin2)
--     or the General Admin JWT.
--   * Locks down `admin_logs` reads to General Admin (JWT) directly;
--     Admin 2 reads its logs through a token-validated RPC.
--   * admin_logs INSERT stays open so visitor entries can still be
--     recorded (append-only feed).
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Session table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_sessions (
  token      text PRIMARY KEY,
  nickname   text NOT NULL,
  role       text NOT NULL CHECK (role IN ('admin2', 'member')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE account_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_sessions_deny_all" ON account_sessions;
-- No direct client access; everything goes through SECURITY DEFINER functions.
CREATE POLICY "account_sessions_deny_all" ON account_sessions USING (false);

-- ── Tighten members writes: authenticated (GA) only ───────────
DROP POLICY IF EXISTS "members_insert" ON members;
DROP POLICY IF EXISTS "members_update" ON members;
DROP POLICY IF EXISTS "members_delete" ON members;
CREATE POLICY "members_auth_insert" ON members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "members_auth_update" ON members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "members_auth_delete" ON members FOR DELETE USING (auth.role() = 'authenticated');
-- members_public_read (SELECT) stays as-is: roster + realtime for everyone.

-- ── Tighten admin_logs reads: authenticated (GA) only ─────────
DROP POLICY IF EXISTS "logs_read" ON admin_logs;
CREATE POLICY "logs_read" ON admin_logs FOR SELECT USING (auth.role() = 'authenticated');
-- logs_insert (INSERT) stays open so anon visitor/admin2 entries record.

-- ══════════════════════════════════════════════════════════════
-- Session helpers & token-gated RPCs
-- ══════════════════════════════════════════════════════════════

-- Resolve a token to its role, or NULL if missing/expired.
CREATE OR REPLACE FUNCTION public.session_role(p_token text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.account_sessions
  WHERE token = p_token AND expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.session_role(text) FROM PUBLIC;

-- Log in a nickname account: verify credentials, mint a 12h token.
-- Returns (role, token). Empty result set => invalid credentials.
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
    RETURN;  -- empty => invalid
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

-- Log out: destroy the session token.
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

-- Admin 2 inserts a blank member into a list. Enforces that the
-- list allows admin2 additions (add_role = 'admin2').
CREATE OR REPLACE FUNCTION public.sess_member_insert(p_token text, p_list_id uuid, p_rank text)
RETURNS members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text; v_add_role text; v_row members;
BEGIN
  v_role := public.session_role(p_token);
  IF v_role <> 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT add_role INTO v_add_role FROM lists WHERE id = p_list_id;
  IF NOT FOUND OR v_add_role <> 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  INSERT INTO members (list_id, nume, luni, porecla, cnp, telefon, inmatriculare,
                       rank, status, task, puncte, photo, executive)
    VALUES (p_list_id, '', '', '', '', '', '', p_rank, 'Activ', 'Neplatit', 0, NULL, false)
    RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.sess_member_insert(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sess_member_insert(text, uuid, text) TO anon, authenticated;

-- Admin 2 updates a member. Accepts the full member object as jsonb;
-- only editable columns are applied (keys present in p_data win,
-- so nulls can clear fields).
CREATE OR REPLACE FUNCTION public.sess_member_update(p_token text, p_id uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.session_role(p_token);
  IF v_role <> 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  UPDATE members SET
    nume          = CASE WHEN p_data ? 'nume'          THEN p_data->>'nume'                    ELSE nume END,
    luni          = CASE WHEN p_data ? 'luni'          THEN p_data->>'luni'                    ELSE luni END,
    porecla       = CASE WHEN p_data ? 'porecla'       THEN p_data->>'porecla'                 ELSE porecla END,
    cnp           = CASE WHEN p_data ? 'cnp'           THEN p_data->>'cnp'                     ELSE cnp END,
    telefon       = CASE WHEN p_data ? 'telefon'       THEN p_data->>'telefon'                 ELSE telefon END,
    inmatriculare = CASE WHEN p_data ? 'inmatriculare' THEN p_data->>'inmatriculare'           ELSE inmatriculare END,
    rank          = CASE WHEN p_data ? 'rank'          THEN p_data->>'rank'                    ELSE rank END,
    status        = CASE WHEN p_data ? 'status'        THEN p_data->>'status'                  ELSE status END,
    task          = CASE WHEN p_data ? 'task'          THEN p_data->>'task'                    ELSE task END,
    puncte        = CASE WHEN p_data ? 'puncte'        THEN (p_data->>'puncte')::integer       ELSE puncte END,
    photo         = CASE WHEN p_data ? 'photo'         THEN p_data->>'photo'                   ELSE photo END,
    hs_driver     = CASE WHEN p_data ? 'hs_driver'     THEN (p_data->>'hs_driver')::boolean    ELSE hs_driver END,
    pilot_heli    = CASE WHEN p_data ? 'pilot_heli'    THEN (p_data->>'pilot_heli')::boolean   ELSE pilot_heli END,
    pilot_avion   = CASE WHEN p_data ? 'pilot_avion'   THEN (p_data->>'pilot_avion')::boolean  ELSE pilot_avion END,
    barca         = CASE WHEN p_data ? 'barca'         THEN (p_data->>'barca')::boolean        ELSE barca END,
    concediu_start= CASE WHEN p_data ? 'concediu_start'THEN (p_data->>'concediu_start')::date  ELSE concediu_start END,
    concediu_end  = CASE WHEN p_data ? 'concediu_end'  THEN (p_data->>'concediu_end')::date    ELSE concediu_end END,
    executive     = CASE WHEN p_data ? 'executive'     THEN (p_data->>'executive')::boolean    ELSE executive END,
    task_log      = CASE WHEN p_data ? 'task_log'      THEN p_data->'task_log'                 ELSE task_log END
  WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.sess_member_update(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sess_member_update(text, uuid, jsonb) TO anon, authenticated;

-- Admin 2 deletes a member.
CREATE OR REPLACE FUNCTION public.sess_member_delete(p_token text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.session_role(p_token);
  IF v_role <> 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  DELETE FROM members WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.sess_member_delete(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sess_member_delete(text, uuid) TO anon, authenticated;

-- Admin 2 reads the action log (General Admin reads the table directly via JWT).
CREATE OR REPLACE FUNCTION public.sess_list_logs(p_token text)
RETURNS SETOF admin_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.session_role(p_token);
  IF v_role <> 'admin2' THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.sess_list_logs(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sess_list_logs(text) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- Force a re-login when General Admin resets an account's password.
-- Redefines reset_account_password (originally created in the fresh
-- setup migration) to also destroy that account's active session
-- tokens, so a compromised old password can't keep an open session.
-- This lives here because account_sessions only exists after this
-- migration runs; the fresh setup file stays runnable standalone.
-- ══════════════════════════════════════════════════════════════
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
  -- Invalidate any active sessions for this account (force re-login).
  IF v_nickname IS NOT NULL THEN
    DELETE FROM public.account_sessions WHERE nickname = v_nickname;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_account_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_account_password(uuid, text) TO authenticated;
