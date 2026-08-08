# ALDRICK ENTERPRISES

React + Vite single-page FiveM faction roster app using Supabase. Motto: "Family is Everything and Everything is Family".

## Stack
- Node.js 20, Vite 8, React 19
- Supabase JS client. **Runtime credentials come from Replit Secrets** (`VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY`), which override the on-disk `.env`. The `.env` file may contain stale/old values — do NOT edit it; trust the shell env / Secrets. Current project ref: `nghnpiundobkoxfixkum`.

## Dev
- Workflow `Start application` runs `npm run dev` on port 5000.
- Vite is configured with host `0.0.0.0`, port `5000`, `allowedHosts: true`, and an `@assets` alias to `attached_assets/` so the logo import works.

## Deployment
- Static deployment: builds with `npm run build`, serves `dist/`.
- **Netlify** — `netlify.toml` holds the whole config: `npm run build` → `dist`, Node 20, the two `VITE_SUPABASE_*` vars, and an SPA catch-all redirect to `index.html`. Connect the repo in Netlify and it deploys as-is; env vars set in Site settings → Environment variables override the ones in the file.

## Auth model (3 tiers + visitor)
- **General Admin (GA)** — Supabase email/password login (email tab in LoginModal). Email: cristeasebastian1000@yahoo.com. Role resolved from `user_roles` table via the real Supabase auth session (NOT localStorage). Full access.
- **Admin 2** — nickname + password stored in `accounts` table (role `admin2`). Logs in via RPC `login_account`, which mints a **server-issued session token** (stored in `account_sessions`, 12h TTL). Runs as anon (no JWT) but carries the token. Manages members through token-validated RPCs (`sess_member_insert/update/delete`), creates Member accounts (re-entering own password → RPC `admin2_create_member`), and views logs via `sess_list_logs`.
- **Member** — nickname + password in `accounts` (role `member`). Logs in via `login_account` (also gets a token). Anon. Roster view only (not `isAdmin`; cannot edit).
- **Visitor** — nickname gate on entry (EntryGate); logs a visit row (`admin_logs`, kind `visit`).
- Session persisted in localStorage: `ev_account_session {nickname,role,token}` (admin2/member) and `ev_visitor {nickname}`. localStorage is a cache only for nickname roles; the `token` is the server-issued session credential. GA authority always comes from the Supabase auth session. Legacy sessions without a `token` are discarded on load (forces re-login to mint one).

### Security model
admin2/member accounts have no JWT, but they DO carry a server-issued session token (`account_sessions`, minted by `login_account`, 12h TTL). Server-side enforcement:
- **`members` writes** — RLS INSERT/UPDATE/DELETE restricted to `authenticated` (GA). Admin 2 writes go through token-validated SECURITY DEFINER RPCs (`sess_member_insert`, `sess_member_update`, `sess_member_delete`) which check `session_role(token) = 'admin2'`. Members (role `member`) and visitors have no write path. `members` SELECT stays public (roster + realtime for all).
- **`admin_logs` reads** — RLS SELECT restricted to `authenticated` (GA, with realtime). Admin 2 reads via `sess_list_logs(token)` (polled every 15s, no realtime for anon). INSERT stays open so visitor/admin2 entries still record (append-only feed).
- Client routing: `_accountToken`/`_accountRole` module vars in `App.jsx` hold the token; if set, member writes and log reads use the RPCs, otherwise GA's direct table access is used.
- Sensitive account ops remain GA-JWT gated (`create_account`, `delete_account`, `list_accounts`); `admin2_create_member` re-verifies the admin2 password.

Residual note: because the token is a bearer credential held in localStorage under the anon key, it is only as strong as the browser's storage — but it can no longer be forged by an arbitrary anon client, and role is enforced in the database.

## Sections (Tabs)
1. **Membri** — Member lists (seeded: Sala Sport / Aldrick Family / Sicarios). Cards with rank system, status/task tracking, points, concediu (leave date range), Executive flag, and license toggles (hidden for Sala Sport lists). Visible to all roles.
2. **Heists**, **Informații Zone**, **Aprobări Zonă**, **Sistem Puncte** — GA-only.
3. **Panel** — GA + Admin 2. Account management + logs (see AdminPanelSection).

## REQUIRED: run the migrations on the Supabase project (in order)
Run these in the Supabase SQL Editor (project `nghnpiundobkoxfixkum`). The anon/service-role keys cannot run DDL, so this must be done manually.
1. `supabase/migrations/20260706_fresh_project_full_setup.sql` — creates all tables (`lists`, `members`, `heists`, `heist_items`, `zone_info`, `zone_approvals`, `puncte_rules`, `user_roles`, `admin_logs`, `accounts`), RLS policies, the account RPCs (`verify_account`, `create_account`, `admin2_create_member`, `reset_account_password`, `delete_account`, `list_accounts`), and seeds the 3 lists + puncte_rules. **`reset_account_password(p_id, p_new_password)` is GA-only (`is_general_admin()` gated) and lets General Admin set a new bcrypt password for any account; re-run this file (idempotent) on existing projects to add it.**
2. `supabase/migrations/20260706_session_tokens_hardening.sql` — **required for the current client.** Adds `account_sessions` + session-token RPCs (`login_account`, `logout_account`, `session_role`, `sess_member_insert/update/delete`, `sess_list_logs`) and tightens RLS so `members` writes are `authenticated`-only and `admin_logs` reads are `authenticated`-only. Without this, Admin 2 login/member edits/log views break (the client calls `login_account`, not `verify_account`).

3. `supabase/migrations/20260808_sala_sport_rename.sql` — **required for existing projects.** Renames the `Frizerie` list to `Sala Sport`, switches its `rank_system`/`list_type` from `frizerie` to `sala_sport`, and remaps every member's rank (`Frizer`→`Personal Trainer`, `Hairstylist`→`Supervizor`, `Manager`→`Manager Sala`). The list keeps its id, so members/sort order/`add_role` are untouched. Idempotent. New projects created from file 1 are already seeded this way and can skip it. The client normalises the legacy `frizerie` key at runtime, so the app keeps working before the migration is run — it just still shows the old list name until then.

After running them, also insert the GA row into `user_roles` (email + role `general_admin`) and create the GA user in Supabase Auth if not already present.

## Notes
- `updateMember` separates license fields from regular fields — gracefully handles missing license columns (PGRST204).
- `logAction(action, details, kind)` writes to `admin_logs`; `logVisit(nickname)` logs a visitor entry (kind `visit`). Panel jurnale view badges rows as Admin vs Vizită.
