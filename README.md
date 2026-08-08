# ALDRICK ENTERPRISES

React 19 + Vite 8 single-page roster app backed by Supabase.

## Local development

```bash
npm install
cp .env.example .env   # Supabase URL + publishable key
npm run dev            # http://localhost:5000
```

## Build

```bash
npm run build          # → dist/
npm run preview
```

## Deploy to Netlify

`netlify.toml` carries the full config, so connecting the repo is enough:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | 20 |
| Redirects | `/*` → `/index.html` (200) — SPA fallback |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` are set in `netlify.toml` too. Both
are public by nature — Vite inlines any `VITE_`-prefixed variable into the
client bundle, and the Supabase key is a *publishable* key. Access control lives
in Supabase RLS and the session-token RPCs, not in the key. To point a deploy at
a different Supabase project, set the two variables in Netlify under
**Site settings → Environment variables**; they override the file.

## Supabase

Run the SQL files in `supabase/migrations/` from the Supabase SQL editor, in
order. `replit.md` documents what each one does and which are required. New
projects need `20260706_fresh_project_full_setup.sql` and
`20260706_session_tokens_hardening.sql`; projects created before the
Frizerie → Sala Sport rename also need `20260808_sala_sport_rename.sql`.

## Lists

| List | Ranks (lowest → highest) | Who can add members |
| --- | --- | --- |
| Sala Sport | Personal Trainer · Supervizor · Manager Sala | Admin 2 and up |
| Aldrick Family | Familia Aldrick … Don Aldrick | General Admin |
| Sicarios | S5 … S1 | General Admin |

Sala Sport members have no points, licenses or task tracking; they do support
the Executive flag and the concediu (leave) date range.
