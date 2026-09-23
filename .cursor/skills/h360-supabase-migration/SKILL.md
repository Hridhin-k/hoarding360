---
name: h360-supabase-migration
description: Applies HOARDINGS360 schema changes to the dedicated live Supabase project only. Use when creating migrations, RLS, PostGIS, Storage buckets, Edge Functions, or when the user mentions schema, SQL, or Supabase for this repo.
---

# Live Supabase migration (H360)

## Project isolation (critical)

Linked live project for this repo:

- **Name:** `harding`
- **Ref:** `bzgdutrmehuojindfyxi`
- **URL:** `https://bzgdutrmehuojindfyxi.supabase.co`

If MCP or CLI targets any other project (hotels, vendors, studio tasks, nuhome, invoicing, etc.):

1. **Stop.** Do not `apply_migration` / `db push`.
2. Re-link: `supabase link --project-ref bzgdutrmehuojindfyxi`
3. Only continue when ref matches `bzgdutrmehuojindfyxi`.

Never use local `supabase start` for this project. Prefer `supabase db push` / `supabase db query --linked`.

## Migration steps

Migrations start from zero (greenfield). Do not restore old remote history.

1. Draft SQL in `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`
2. Include: org/tenant boundary, RLS enable, policies, indexes (GiST for location)
3. Apply with `supabase db push` (linked to `bzgdutrmehuojindfyxi`) or MCP against that project only
4. Verify: `supabase migration list --linked` + `supabase db query --linked "…"` + advisors
5. Regenerate or hand-update types under `lib/database.types.ts` if present

## First migration expectations (Phase 0/1)

Enable PostGIS, then create at minimum:

- `tenants`, `tenant_members`, `profiles`
- `boards` (geography point), `board_faces`
- Reserved empty shells for campaigns / leases / work_orders when touching foundation

## Edge Functions

Deploy with MCP `deploy_edge_function` to the **same** live project. Keep secrets in Supabase Function secrets, not in git.

## Rollback

Prefer forward-fix migrations. If a bad migration landed on live, write a new compensating migration — do not rewrite history on shared live DB without explicit user approval.
