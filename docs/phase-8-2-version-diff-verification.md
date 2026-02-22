# Phase 8.2 — Version Comparison / Diff: Verification Report (TEST ONLY)

**Date:** Verification run (test-only; no code changes).  
**Scope:** Confirm presence and behavior of version comparison / diff feature.  
**Guardrails:** No refactor of core logic. No changes to archive, saved_links, queries, Stripe, or auth.

---

## Summary

**The version comparison and “What Changed” / diff feature described in the test criteria is not implemented in the codebase.**

The system currently:

- Generates new briefs (v+1) via `POST /api/cases/[caseId]/brief`.
- Lists briefs by `version_number` (desc) and allows viewing one brief at a time.
- Does **not** load two `brief_json` versions for comparison.
- Does **not** compute or display diffs (timeline, hypotheses, critical_gaps, contradictions).
- Does **not** have a “What Changed” or “Version Differences” UI section.

Therefore the following cannot be verified as implemented; they are **not present**.

---

## 1) Version comparison logic — **NOT IMPLEMENTED**

- **Current behavior:**  
  - User can generate a new brief (v+1).  
  - User can open a single brief (by id); `handleView(b)` fetches that brief only.  
  - No API or UI loads “current version” and “previous version” together.  
  - No code compares two `brief_json` objects.

- **Result:**  
  - Cannot confirm “system can compare current version vs previous version.”  
  - No diff for: added/removed/changed timeline items, hypotheses, critical_gaps, or contradictions.

---

## 2) Diff rendering — **NOT IMPLEMENTED**

- **Current behavior:**  
  - Brief viewer shows one brief’s content (Executive Overview, Working Timeline, Key Entities, Contradictions, Verification Tasks, Evidence Strength, Hypotheses, Critical Gaps, Saved link notes).  
  - No “What Changed” or “Version Differences” section.  
  - No “Added” / “Removed” / “Modified” labels for content differences.

- **Result:**  
  - UI does not show version differences.  
  - No content diff to verify.

---

## 3) Isolation (design note for future implementation)

- **Current state:** No diff engine exists; no AI is invoked for diffing.
- **If a diff feature is added later:**  
  - Diff should be computed **locally** from stored `brief_json` (e.g. current vs previous row from `case_briefs`).  
  - Diff should **not** trigger brief regeneration.  
  - Diff should **not** call OpenAI or any external API.

---

## 4) Verified flag and diff (design note)

- **Current state:** Verified flag (Phase 8.1) is user-controlled and persisted via PATCH. No diff feature exists.
- **If diff is added:**  
  - Changing only `verified` on a timeline item could be treated as “structural” or “content” depending on product choice.  
  - Recommended: either exclude `verified` from diff, or show it under a clear “Verified (user) changes” bucket so it doesn’t clutter structural/content diff.

---

## 5) Performance (design note)

- **Current state:** No diff computation, so no performance impact.  
- **If diff is added:** Comparison should be in-memory (two `brief_json` objects); no extra DB writes and no new version creation when only viewing a diff.

---

## 6) PDF

- **Current behavior:**  
  - PDF is generated from a single brief’s `brief_json` in `lib/pdf/brief-to-pdf.ts`.  
  - No diff or “What Changed” section is included in the PDF.  
- **Result:** PDF still renders one brief; no diff in PDF. No regression from a non-existent diff feature.

---

## Files changed

**None.** Test-only verification; no code or config was modified.

---

## Confirmations

| Item | Status |
|------|--------|
| Diff is purely version-to-version JSON comparison | **N/A** — No diff feature exists. When/if implemented, it should be local comparison of two `brief_json` objects. |
| No AI calls during diff | **Confirmed** — No diff code exists; the only AI usage is in `app/api/cases/[caseId]/brief/route.ts` for **generation** (POST), not for any comparison. |
| No regressions to generation pipeline | **Confirmed** — No changes were made; generation pipeline (POST brief, validate, insert `case_briefs`) is unchanged. |

---

## What would be required to meet the test criteria

To satisfy the Phase 8.2 version-diff test criteria, the codebase would need:

1. **Data:** Ability to load two brief versions (e.g. current and previous by `version_number`) and their `brief_json`.
2. **Logic:** A pure, local diff of two `brief_json` objects producing:  
   - Added/removed/changed timeline items (e.g. by index or stable key).  
   - Added/removed hypotheses, critical_gaps, contradictions.  
   - Optional: treat `verified` separately or exclude from “structural” diff.
3. **UI:** A “What Changed” or “Version Differences” section that shows Added / Removed / Modified with actual content, not a vague summary.
4. **No:** Regeneration, OpenAI calls, extra DB writes, or new version creation when only viewing a diff.

This verification report does not implement the above; it only records current state and design notes.
