---
name: h360-release-gate
description: Checks HOARDINGS360 release exit criteria and V2.0 marketplace launch readiness before promoting a version. Use when finishing a phase, asking "are we ready for V2", production launch, or go-live checklist.
---

# Release gate check

Compare current repo + live DB against `.cursor/rules/roadmap.mdc` for the target version.

## Always verify

- [ ] Features shipped map to module IDs for that version only (no silent scope creep)
- [ ] RLS enabled on new tables; `get_advisors` reviewed
- [ ] Three-status model intact in UI
- [ ] No service role in client
- [ ] Indian formats on money/dates

## Version exit sniff tests

| Version | Must be true |
|---------|----------------|
| V0 | Live Auth login; migrations pipeline; shell routes exist |
| V1.0 | Boards+faces+compliance+agreements+occupancy+import; dashboard live |
| V1.1 | Field offline proof upload; incidents; QR open board |
| V2.0 | Market product path below (not inventory scale) |
| V2.1 | Plan → PDF/share link &lt;10 min path works |
| V3.0 | Quote→pay→invoice; commission only marketplace-originated |
| V4.0 | Work order + lease cost on Board 360 |
| V5.0 | API or white-label path documented and gated |

## V2.0 marketplace launch readiness

**Not criteria:** face count quotas, owner-count quotas, or “% photos under N months” inventory thresholds.

**Do check:**

- [ ] Public reads projection/listings only — no floor rates, costs, or client names
- [ ] Expired mandatory clearance auto-unpublishes (override audited)
- [ ] Browse → listing → enquiry (and hold if shipped) works
- [ ] Owner can see/respond to enquiries in Manage
- [ ] RLS + advisors reviewed; DPDP/pen-test noted under continuous production readiness

If product path fails: fix Market correctness. Do **not** block on inventory scale.

## Output format

```markdown
## Gate: Vx.x
Status: PASS | FAIL | PARTIAL
Evidence:
- ...
Blockers:
- ...
Next actions:
- ...
```
