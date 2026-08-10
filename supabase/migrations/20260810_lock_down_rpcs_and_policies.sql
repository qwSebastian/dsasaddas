-- ══════════════════════════════════════════════════════════════
-- SECURITY HARDENING — policies + RPC grants
--
-- Written against the live database, which had drifted from the
-- migration files: re-running the fresh-setup file recreated its
-- permissive starter policies alongside the strict ones, and every
-- function in `public` was executable by `anon`.
--
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- 1. Row-level security
-- ══════════════════════════════════════════════════════════════

-- Permissive policies are OR'd together, so `members_insert` (true)
-- sitting beside `members_auth_insert` (authenticated) meant anyone
-- holding the publishable key could write to the roster. Collapse to
-- one strict set per command.
DROP POLICY IF EXISTS "members_insert"      ON members;
DROP POLICY IF EXISTS "members_update"      ON members;
DROP POLICY IF EXISTS "members_delete"      ON members;
DROP POLICY IF EXISTS "members_auth_insert" ON members;
DROP POLICY IF EXISTS "members_auth_update" ON members;
DROP POLICY IF EXISTS "members_auth_delete" ON members;

-- `TO authenticated` keys off the Postgres role rather than a JWT-claim
-- helper, and the predicate keeps the advisor's always-true check quiet.
CREATE POLICY "members_auth_insert" ON members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "members_auth_update" ON members FOR UPDATE TO authenticated USING      (auth.uid() IS NOT NULL);
CREATE POLICY "members_auth_delete" ON members FOR DELETE TO authenticated USING      (auth.uid() IS NOT NULL);
-- members_public_read (SELECT true) is deliberate: the roster is public,
-- and visitors plus realtime depend on it.

-- The journal was readable by anyone with the publishable key. Details
-- now carry field-level edits (CNP, phone, plate), so this matters.
DROP POLICY IF EXISTS "logs_read" ON admin_logs;
CREATE POLICY "logs_read" ON admin_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
-- logs_insert stays open on purpose: visitors and Admin 2 have no JWT and
-- still need to record entries. Admin 2 reads through sess_list_logs().

-- ══════════════════════════════════════════════════════════════
-- 2. Drop functions nothing calls any more
-- ══════════════════════════════════════════════════════════════
-- Superseded by the accounts/session model. The client calls none of
-- them; they only widen the surface.
DROP FUNCTION IF EXISTS public.create_admin2_account(text, text);
DROP FUNCTION IF EXISTS public.delete_admin2_account(uuid);
DROP FUNCTION IF EXISTS public.list_admin2_accounts();
DROP FUNCTION IF EXISTS public.verify_admin2(text, text);
DROP FUNCTION IF EXISTS public.verify_account(text, text);

-- ══════════════════════════════════════════════════════════════
-- 3. RPC grants
-- ══════════════════════════════════════════════════════════════
-- These four are General Admin operations. Each already refuses anon
-- via is_general_admin(), so this is defence in depth rather than a
-- hole being closed — an unauthenticated caller could reach them and
-- be rejected. Now it cannot reach them at all.
REVOKE ALL ON FUNCTION public.create_account(text, text, text)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_account(uuid)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_accounts()                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_account_password(uuid, text)    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_account(text, text, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_accounts()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_account_password(uuid, text) TO authenticated;

-- Only the sess_* wrappers call this, and they are SECURITY DEFINER, so
-- they keep working without the caller holding EXECUTE.
REVOKE ALL ON FUNCTION public.session_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_role(text) TO authenticated;

-- Left callable by anon, deliberately:
--   login_account, logout_account  — sign-in happens before any session
--                                    exists; login_account checks the
--                                    bcrypt password itself.
--   sess_member_insert/update/delete, sess_list_logs
--                                  — Admin 2 holds no JWT; each verifies
--                                    the session token server-side.
--   admin2_create_member           — re-verifies the caller's own admin2
--                                    password before creating anything.
--   is_general_admin               — returns false for anon and is
--                                    referenced inside RLS policies, so
--                                    the querying role needs EXECUTE on
--                                    it. Revoking it breaks reads.

COMMIT;

-- ── Verify ────────────────────────────────────────────────────
-- Expect: members = 1 public SELECT + 3 authenticated writes,
--         logs_read no longer `true`,
--         anon_can_call false for the four account functions.
--
-- SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname='public'
--    AND tablename IN ('members','admin_logs') ORDER BY tablename, cmd;
--
-- SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_call
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname='public' ORDER BY anon_can_call DESC, p.proname;
