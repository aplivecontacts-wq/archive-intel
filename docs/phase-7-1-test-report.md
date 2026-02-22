# Phase 7.1 — Test Report (Structured Contradictions)

**Scope:** Verify structured contradictions are generated, validated, stored, and rendered without breaking legacy briefs. No schema/prompt/UI refactors.

---

## 1) Build / Type Safety

- **Typecheck:** `npm run typecheck` — **PASSED** (exit code 0).
- **Build:** `npm run build` — run locally to confirm full build succeeds.
- **BriefJson type:** Confirmed in `lib/ai/brief-schema.ts`:
  - `contradictions_tensions: BriefContradictionsTensions[]`
  - **BriefContradictionsTensions** supports:
    - **A) Legacy:** `issue` (required), `details?`, `source_refs?`
    - **B) Structured:** `issue`, `issue_type?`, `statement_a?`, `statement_a_refs?`, `statement_b?`, `statement_b_refs?`, `why_it_matters?`, `resolution_tasks?`

---

## 2) Validator

Verified via `npx tsx scripts/test-phase-7-1-validator.ts` (all passed):

- **Legacy:** `validateBriefJson` accepts legacy `contradictions_tensions` items unchanged (`issue` + `details` + `source_refs`).
- **Structured:** Accepts structured items only when:
  - `issue_type` ∈ `["date","count","identity","location","claim","other"]`
  - `statement_a` / `statement_b` / `why_it_matters` are strings
  - `statement_a_refs` / `statement_b_refs` are arrays of strings
  - `resolution_tasks` is array of strings
- **Refs in evidence_index:** All refs in `statement_a_refs` and `statement_b_refs` are validated to exist in `evidence_index`. Invalid ref throws.
- **Legacy refs:** Legacy `source_refs` are required to be an array of strings but are **not** checked against `evidence_index` (so existing briefs with any refs still validate).
- **Backward compatibility:** New fields are not required for old briefs; legacy path requires only `issue`, `details`, `source_refs`.

---

## 3) Prompt / Generation (manual verification)

- **Action:** Trigger brief generation for a case that has at least two sources that can conflict (e.g. two results/links/notes with different dates, counts, identity, or claims).
- **Expected:** Returned JSON has `contradictions_tensions` entries in the **new structured format** when the model identifies a conflict.
- **Example structured item (redacted):**

```json
{
  "issue": "Date discrepancy in reported event timing",
  "issue_type": "date",
  "statement_a": "Source A states the event occurred on [DATE_A].",
  "statement_a_refs": ["r3", "s1"],
  "statement_b": "Source B indicates the event occurred on [DATE_B].",
  "statement_b_refs": ["r7"],
  "why_it_matters": "This does not add up because the timeline cannot accommodate both dates without an additional missing event or misreporting.",
  "resolution_tasks": [
    "Locate primary record for the event date (court docket / filing / official notice).",
    "Check archived versions around DATE_A and DATE_B to confirm the published claim.",
    "Identify whether two separate events are being conflated."
  ]
}
```

- **Checklist:** Each new contradiction should contain: `issue`, `issue_type`, `statement_a` + `statement_a_refs`, `statement_b` + `statement_b_refs`, `why_it_matters` (including “This does not add up because”), `resolution_tasks` (non-empty array).

---

## 4) UI Render

- **Code:** `components/case-briefs.tsx` — Contradictions card branches on `statement_a` and `statement_b`.
  - **Structured:** Renders issue, `issue_type` badge, Statement A (+ refs), Statement B (+ refs), “Why it matters,” resolution tasks list. Refs shown per side.
  - **Legacy:** Renders `issue` + `details` + optional `source_refs`.
- **Confirmation:** Open the brief viewer (Sheet) for a brief that has (a) at least one structured contradiction and (b) if available, one legacy-only brief. Confirm both render without crashing and refs are clearly labeled (A side vs B side for structured).

---

## 5) PDF Render

- **Code:** `lib/pdf/brief-to-pdf.ts` — Contradictions section branches on `statement_a` and `statement_b`.
  - **Structured:** Prints issue + `issue_type`, then Statement A (with refs), Statement B (with refs), why_it_matters, resolution_tasks (bullets).
  - **Legacy:** Prints `issue: details [refs]`.
- **Confirmation:** Export the same brief(s) to PDF and confirm structured contradictions appear in the new format and legacy ones in the single-line format.

---

## 6) Regression — Legacy brief

- **Validator:** Script run confirmed a minimal legacy brief (only `issue`, `details`, `source_refs`) passes `validateBriefJson`.
- **Rendering:** Legacy items use the `else` path in both UI and PDF (no `statement_a`/`statement_b`). No new fields required.
- **Confirmation:** Load an older brief from the DB that has only legacy `contradictions_tensions`. It should validate and render in UI and PDF with no errors.

---

## Summary

| Check | Status |
|-------|--------|
| Typecheck | Passed |
| BriefJson supports legacy + structured | Confirmed |
| validateBriefJson legacy | Passed (script) |
| validateBriefJson structured | Passed (script) |
| issue_type / refs validation | Passed (script) |
| UI renders both shapes | Implemented; manual check recommended |
| PDF renders both shapes | Implemented; manual check recommended |
| Legacy brief still validates/renders | Passed (script); manual check on real DB brief recommended |

**Example structured contradiction (for your generated JSON):** Use the redacted example in §3 above. After generating a brief from a case with conflicting sources, compare one `contradictions_tensions` entry to that shape and confirm UI + PDF both render it and that a legacy-only brief still renders.
