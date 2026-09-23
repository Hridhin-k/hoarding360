# Migrations (greenfield)

Start from empty. New files only:

```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

Apply to live project `harding` (`bzgdutrmehuojindfyxi`):

```bash
supabase db push
# or
supabase migration up --linked
```

Never recreate old remote history. First real migration should enable PostGIS (if needed) and foundation tables per roadmap Phase 0/1.
