# HOARDINGS360 MVP

Outdoor media **operating system** (Manage/CRM) + **marketplace** + **field PWA**, powered by **Next.js** and a **live Supabase** backend.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (Market · Manage · Field PWA) |
| Backend | Live Supabase (Auth, Postgres+PostGIS, RLS, Storage, Edge Functions) |
| Deploy | Vercel + Supabase Cloud |

Local Supabase is intentionally **not** used.

## Quick start

```bash
npm install
# .env.local is already wired to live project harding (bzgdutrmehuojindfyxi)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase (live)

```bash
supabase login
supabase init          # already done
supabase link --project-ref bzgdutrmehuojindfyxi   # linked ✓
```

Project: **harding** · `https://bzgdutrmehuojindfyxi.supabase.co`  
Do **not** run `supabase start` (no local DB).

## Building with Cursor

Read **[docs/CURSOR_SETUP.md](docs/CURSOR_SETUP.md)**.

1. Follow `.cursor/rules/roadmap.mdc` Phase 0 → production.
2. Use skills: `h360-ship-feature`, `h360-supabase-migration`, `h360-release-gate`.
3. Point Cursor Supabase MCP at project `bzgdutrmehuojindfyxi` when using agent SQL tools.

## Product surfaces

- `/` — Marketplace (advertisers)
- `/manage` — Owner OS / CRM
- `/field` — Field technician PWA
- `/admin` — Platform Super Admin
