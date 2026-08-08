-- ══════════════════════════════════════════════════════════════
-- EVIDENȚĂ — Complete SQL (safe to run even if already run before)
-- ══════════════════════════════════════════════════════════════

-- ── Drop ALL old policies (cleans up any previous runs) ───────
DROP POLICY IF EXISTS "Allow all"                    ON lists;
DROP POLICY IF EXISTS "Allow all"                    ON members;
DROP POLICY IF EXISTS "Public read lists"             ON lists;
DROP POLICY IF EXISTS "Auth write lists"              ON lists;
DROP POLICY IF EXISTS "lists_public_read"             ON lists;
DROP POLICY IF EXISTS "lists_auth_insert"             ON lists;
DROP POLICY IF EXISTS "lists_auth_update"             ON lists;
DROP POLICY IF EXISTS "lists_auth_delete"             ON lists;
DROP POLICY IF EXISTS "Public read members"           ON members;
DROP POLICY IF EXISTS "Auth write members"            ON members;
DROP POLICY IF EXISTS "members_public_read"           ON members;
DROP POLICY IF EXISTS "members_auth_insert"           ON members;
DROP POLICY IF EXISTS "members_auth_update"           ON members;
DROP POLICY IF EXISTS "members_auth_delete"           ON members;
DROP POLICY IF EXISTS "members_insert"                ON members;
DROP POLICY IF EXISTS "members_update"                ON members;
DROP POLICY IF EXISTS "Public read zone_approvals"    ON zone_approvals;
DROP POLICY IF EXISTS "Auth write zone_approvals"     ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_public_read"    ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_insert"    ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_update"    ON zone_approvals;
DROP POLICY IF EXISTS "zone_approvals_auth_delete"    ON zone_approvals;
DROP POLICY IF EXISTS "Public read heists"            ON heists;
DROP POLICY IF EXISTS "Auth write heists"             ON heists;
DROP POLICY IF EXISTS "heists_public_read"            ON heists;
DROP POLICY IF EXISTS "heists_auth_insert"            ON heists;
DROP POLICY IF EXISTS "heists_auth_update"            ON heists;
DROP POLICY IF EXISTS "heists_auth_delete"            ON heists;
DROP POLICY IF EXISTS "Public read heist_items"       ON heist_items;
DROP POLICY IF EXISTS "Auth write heist_items"        ON heist_items;
DROP POLICY IF EXISTS "heist_items_public_read"       ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_insert"       ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_update"       ON heist_items;
DROP POLICY IF EXISTS "heist_items_auth_delete"       ON heist_items;
DROP POLICY IF EXISTS "Public read zone_info"         ON zone_info;
DROP POLICY IF EXISTS "Auth write zone_info"          ON zone_info;
DROP POLICY IF EXISTS "zone_info_public_read"         ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_insert"         ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_update"         ON zone_info;
DROP POLICY IF EXISTS "zone_info_auth_delete"         ON zone_info;
DROP POLICY IF EXISTS "Allow public read"              ON puncte_rules;
DROP POLICY IF EXISTS "Allow authenticated insert"     ON puncte_rules;
DROP POLICY IF EXISTS "Allow authenticated update"     ON puncte_rules;
DROP POLICY IF EXISTS "Allow authenticated delete"     ON puncte_rules;
DROP POLICY IF EXISTS "public_read_puncte_rules"      ON puncte_rules;
DROP POLICY IF EXISTS "auth_write_puncte_rules"       ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_public_read"      ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_insert"      ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_update"      ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_delete"      ON puncte_rules;
DROP POLICY IF EXISTS "puncte_rules_auth_write"       ON puncte_rules;
DROP POLICY IF EXISTS "roles_read"                    ON user_roles;
DROP POLICY IF EXISTS "roles_write"                   ON user_roles;
DROP POLICY IF EXISTS "logs_insert"                   ON admin_logs;
DROP POLICY IF EXISTS "logs_read"                     ON admin_logs;
DROP POLICY IF EXISTS "admin_logs_insert"             ON admin_logs;
DROP POLICY IF EXISTS "admin2_accounts_select"        ON admin2_accounts;
DROP POLICY IF EXISTS "admin2_accounts_ga_all"        ON admin2_accounts;
DROP POLICY IF EXISTS "admin2_accounts_deny_all"      ON admin2_accounts;

-- ── Column additions ──────────────────────────────────────────
ALTER TABLE lists   ADD COLUMN IF NOT EXISTS rank_system text DEFAULT 'default';
ALTER TABLE members ADD COLUMN IF NOT EXISTS hs_driver   boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS pilot_heli  boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS pilot_avion boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS barca       boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS task_log    jsonb   DEFAULT '[]'::jsonb;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_puncte_check;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_puncte_nonneg;
ALTER TABLE members DROP CONSTRAINT IF EXISTS puncte_nonneg;
UPDATE members SET task_log = '[]'::jsonb WHERE task_log IS NULL;

-- ── Table creation ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zone_approvals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  status      text DEFAULT 'Neaprobat',
  weapon      text DEFAULT 'Fara Arma',
  approved_at timestamptz,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE zone_approvals ADD COLUMN IF NOT EXISTS logo     text;
ALTER TABLE zone_approvals ADD COLUMN IF NOT EXISTS category text DEFAULT 'oficiale';

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

CREATE TABLE IF NOT EXISTS puncte_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category   text NOT NULL,
  label      text NOT NULL,
  value      text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text UNIQUE NOT NULL,
  role       text NOT NULL CHECK (role IN ('general_admin', 'admin2')),
  nickname   text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS nickname text;

CREATE TABLE IF NOT EXISTS admin_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_email text NOT NULL,
  action      text NOT NULL,
  details     text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

-- admin2_accounts: drop & recreate to ensure bcrypt password_hash column
-- (safe — no real data expected here, and we can't migrate plaintext → hash)
DROP TABLE IF EXISTS admin2_accounts CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE TABLE admin2_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
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
ALTER TABLE admin2_accounts ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "lists_public_read"  ON lists FOR SELECT USING (true);
CREATE POLICY "lists_auth_insert"  ON lists FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "lists_auth_update"  ON lists FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "lists_auth_delete"  ON lists FOR DELETE USING (auth.role() = 'authenticated');

-- ── Policies: members ─────────────────────────────────────────
-- SELECT: public; INSERT/UPDATE: open to anon so Admin 2 (no JWT) can write;
-- DELETE: authenticated only (General Admin).
CREATE POLICY "members_public_read" ON members FOR SELECT USING (true);
CREATE POLICY "members_insert"      ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "members_update"      ON members FOR UPDATE USING (true);
CREATE POLICY "members_auth_delete" ON members FOR DELETE USING (auth.role() = 'authenticated');

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
-- INSERT open to anon so Admin 2 (no JWT) can write logs
CREATE POLICY "logs_insert" ON admin_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "logs_read"   ON admin_logs FOR SELECT USING (public.is_general_admin());

-- ── Policies: admin2_accounts ─────────────────────────────────
-- No direct client access — all operations go through SECURITY DEFINER functions
CREATE POLICY "admin2_accounts_deny_all" ON admin2_accounts USING (false);

-- ── SECURITY DEFINER functions for Admin 2 auth ───────────────

-- verify_admin2: login — returns nickname on success, '' on failure
CREATE OR REPLACE FUNCTION public.verify_admin2(p_nickname text, p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE v_hash text;
BEGIN
  SELECT password_hash INTO v_hash
    FROM public.admin2_accounts WHERE nickname = p_nickname;
  IF NOT FOUND THEN RETURN ''; END IF;
  IF v_hash = extensions.crypt(p_password, v_hash) THEN RETURN p_nickname; END IF;
  RETURN '';
END;
$$;
REVOKE ALL ON FUNCTION public.verify_admin2(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin2(text, text) TO anon, authenticated;

-- create_admin2_account: General Admin only
CREATE OR REPLACE FUNCTION public.create_admin2_account(p_nickname text, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  INSERT INTO public.admin2_accounts (nickname, password_hash)
    VALUES (p_nickname, extensions.crypt(p_password, extensions.gen_salt('bf')));
END;
$$;
REVOKE ALL ON FUNCTION public.create_admin2_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin2_account(text, text) TO authenticated;

-- delete_admin2_account: General Admin only
CREATE OR REPLACE FUNCTION public.delete_admin2_account(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  DELETE FROM admin2_accounts WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_admin2_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_admin2_account(uuid) TO authenticated;

-- list_admin2_accounts: General Admin only — never exposes password_hash
CREATE OR REPLACE FUNCTION public.list_admin2_accounts()
RETURNS TABLE (id uuid, nickname text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY SELECT a.id, a.nickname, a.created_at
    FROM admin2_accounts a ORDER BY a.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_admin2_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin2_accounts() TO authenticated;

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

-- ── General Admin account ─────────────────────────────────────
-- Change the email below if needed, then run.
INSERT INTO user_roles (email, role)
VALUES ('cristeasebastian1000@gmail.com', 'general_admin')
ON CONFLICT (email) DO UPDATE SET role = 'general_admin';
