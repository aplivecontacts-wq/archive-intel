# Phase 6.2 — Test Report (Optional evidence_strength)

**Scope:** Verify optional evidence_strength validates, stores, and renders; old briefs without it still work. No refactor. No backward-compatibility break.

---

## 1) Build / Typecheck

- **Typecheck:** `npm run typecheck` — **PASSED** (exit code 0).
- **Build:** Run `npm run build` locally and ensure it completes.

---

## 2) Validator checks — CONFIRMED (code)

- **BriefJson:** In `lib/ai/brief-schema.ts`, `evidence_strength?: EvidenceStrengthItem[]` — **optional** (line 80).
- **validateBriefJson:**
  - **Missing allowed:** Validation runs only when `es !== undefined` (line 264). Old briefs with no `evidence_strength` pass.
  - **When present**, each item is validated:
    - `theme` (string)
    - `results_count` (number)
    - `saved_links_count` (number)
    - `wayback_count` (number)
    - `note_count` (number)
    - `corroboration_estimate` (string)
    - `strength_rating` in `["high","medium","low"]`

---

## 3) Generate a new brief (manual)

- Trigger brief generation on a case with enough evidence to produce themes (multiple queries/results/saved links/notes).
- Inspect `brief_json` (e.g. from DB or API response):
  - `evidence_strength` may **exist** or be **omitted** (both valid).
  - If present:
    - Length typically ~3–8 (per prompt: "Generate 3–8 thematic entries maximum").
    - Entries are per **theme** (not per query).
    - Counts are **numbers** (not strings).
    - `strength_rating` is one of `high` | `medium` | `low`.

---

## 4) UI render — CONFIRMED (code)

- **Location:** `components/case-briefs.tsx` (Evidence Strength card).
- **Behavior:**
  - Renders **only when** `Array.isArray(bj.evidence_strength) && bj.evidence_strength.length > 0`; otherwise `null` (no section, no crash).
  - When shown: theme, strength_rating badge, counts (results · saved links · wayback · notes), corroboration_estimate.
- **Manual check:** Open the brief viewer Sheet; confirm Evidence Strength section appears only when the brief has `evidence_strength` with items; open a brief without it and confirm no crash and no Evidence Strength section.

---

## 5) PDF render — CONFIRMED (code)

- **Location:** `lib/pdf/brief-to-pdf.ts` (section 7).
- **Behavior:**
  - Section added **only when** `evidenceStrength && Array.isArray(evidenceStrength) && evidenceStrength.length > 0`.
  - Old briefs without `evidence_strength` skip this section and export normally.
- **Manual check:** Export a brief that has `evidence_strength` — Evidence Strength Matrix section should appear. Export an old brief without it — PDF should generate with no Evidence Strength Matrix section.

---

## REPORT BACK (fill after running the test)

### One evidence_strength item JSON (redacted)

*Paste one element from a generated brief’s `evidence_strength` array (redact if needed).*

Example shape:

```json
{
  "theme": "[Theme name, e.g. ownership of assets in region X]",
  "results_count": 5,
  "saved_links_count": 2,
  "wayback_count": 3,
  "note_count": 1,
  "corroboration_estimate": "multiple independent sources",
  "strength_rating": "medium"
}
```

---

### Confirmation: UI + PDF show/hide correctly

- [ ] Brief **with** evidence_strength: Evidence Strength (Matrix) section appears in Sheet and in exported PDF.
- [ ] Brief **without** evidence_strength: No Evidence Strength section in Sheet; no crash; PDF exports without Evidence Strength Matrix section.

---

### Confirmation: Old brief still renders

- [ ] Opened an older brief from DB (no or empty evidence_strength).
- [ ] Sheet opens with no errors.
- [ ] PDF export completes with no errors.

---

## Summary

| Check | Status |
|-------|--------|
| Typecheck | Passed |
| evidence_strength optional in BriefJson | Confirmed |
| Validator: missing allowed | Confirmed |
| Validator: when present, all fields validated | Confirmed |
| UI: section only when present; no crash when missing | Confirmed (code) |
| PDF: section only when present; old briefs export | Confirmed (code) |
| New brief generation / inspect JSON | Manual |
| UI + PDF show/hide + old brief | Manual confirmation |

Complete the "Report back" section after generating a new brief and opening/exporting an old one.
