# HOARDINGS360 — Cursor Project Guide

## Stack

- **Next.js 16** (App Router) — Market + Manage/CRM + Field PWA in one app
- **Live Supabase only** — Auth, Postgres + PostGIS, RLS, Storage, Edge Functions
- **Vercel** for the web app

Do not run local Supabase. Do not use NestJS.

## Cursor setup

### Rules (`.cursor/rules/`)

| File | Purpose |
|------|---------|
| `roadmap.mdc` | Phase-by-phase build plan V0 → production |
| `hoardings360-product.mdc` | Domain principles |
| `supabase-live.mdc` | Live-only backend + isolation |
| `nextjs-surfaces.mdc` | Route groups & UI budgets |
| `supabase-migrations.mdc` | SQL / Edge Function conventions |

### Skills (`.cursor/skills/`)

| Skill | When to invoke |
|-------|----------------|
| `h360-ship-feature` | Building any module/screen |
| `h360-supabase-migration` | Schema / RLS / functions |
| `h360-release-gate` | End of phase / go-live |

Example: *“Using h360-ship-feature, build M02 Board 360 overview for V1.0.”*

## Linked Supabase (done)

| Field | Value |
|-------|-------|
| Project | `harding` |
| Ref | `bzgdutrmehuojindfyxi` |
| URL | `https://bzgdutrmehuojindfyxi.supabase.co` |

CLI linked. `.env.local` holds anon + service role keys (gitignored).

**Schema + migrations:** wiped clean (greenfield). `supabase/migrations/` is empty; remote `schema_migrations` has 0 rows. First migration starts Phase 0/1.

Optional: add a Cursor Supabase MCP entry pointed at this same project for agent SQL tools.

## Next

Phase 0 is live: migration `20260923120000_phase0_foundation`, auth, Manage/Market/Field/Admin shells.

```bash
npm run dev
```

Then: `/auth/signup` → `/manage` → Add board.

In Supabase Auth settings, disable “Confirm email” for local testing if sign-up does not return a session.

## Route map

| URL | Product |
|-----|---------|
| `/` | Marketplace |
| `/manage` | Owner OS / CRM |
| `/field` | Field PWA |
| `/admin` | Super Admin |

## Docs

- Full roadmap: `.cursor/rules/roadmap.mdc`
- Product PDFs: (internal attachments / Master Product Document)
