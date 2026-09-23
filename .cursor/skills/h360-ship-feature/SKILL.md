---
name: h360-ship-feature
description: Ships a HOARDINGS360 feature end-to-end (schema → RLS → Next.js UI → verify) mapped to module IDs M01–M35 and release versions. Use when implementing Manage, Market, Field, or Admin features, or when the user asks to build a module or screen.
---

# Ship an H360 feature

## Before coding

1. Identify **module ID** (M01–M35) and **version** (V0–V5.0) from `.cursor/rules/roadmap.mdc`.
2. Refuse to build Market-facing features before Phase 1 Manage core exists (unless explicitly fixing projection plumbing).
3. Confirm live H360 Supabase project is the MCP target — see skill `h360-supabase-migration`.

## Workflow checklist

```
- [ ] Spec: entity fields + statuses + who may see what
- [ ] Migration on LIVE H360 project
- [ ] RLS policies + advisor check
- [ ] TypeScript types in lib/domain
- [ ] Server read/write via lib/supabase/server.ts
- [ ] UI in correct route group (market|manage|field|admin)
- [ ] Activity/audit event if legally relevant
- [ ] Empty/error/loading states
- [ ] Module ID noted in PR/commit body
```

## Surface pick

| If building… | Put code in |
|--------------|-------------|
| Owner OS / CRM | `app/(manage)/…` |
| Public marketplace | `app/(market)/…` |
| Technician PWA | `app/(field)/…` |
| Platform staff | `app/(admin)/…` |
| Cross-cutting domain | `lib/domain/…` |

## Board 360 rule

Any new board-related data appears as a **tab or section on Board 360**, even if empty with “coming in Vx.x”.

## Do not

- Combine lifecycle/compliance/occupancy into one badge
- Show floor rates or costs to Sales
- Call service-role client from the browser
- Skip soft-delete / reason on destructive actions

## Done when

Phase exit criteria for that module’s version in `.cursor/rules/roadmap.mdc` are met or explicitly deferred with reason.
