# Phase 6.1 — Test Report (Analyst-Style Briefs / Two-Pass Reasoning)

**Scope:** Verify the 6.1 prompt upgrade produces analyst-style briefs (two-pass reasoning) without breaking schema/DB/UI. Test only — no refactor.

---

## 1) Code change location — CONFIRMED

- **File:** `app/api/cases/[caseId]/brief/route.ts`
- **Only the following are used for 6.1 behavior:**
  - **BRIEF_SYSTEM_PROMPT** (lines 22–430): Two-pass protocol (PASS 1 fact extraction, PASS 2 appraisal & synthesis), analytical requirements (no topic lists, cross-query synthesis, what’s missing, what would disprove, analyst tone, no fabrication), schema rules, optional evidence_strength and threads, plus Phase 7.1 structured contradictions block.
  - **userContent** (line 446): `Evaluate the case evidence below using the investigative protocol. Return ONLY valid JSON.\n\n${JSON.stringify(payload)}`
- **generateStructuredJson** call (lines 449–453): Unchanged — `generateStructuredJson<unknown>(BRIEF_SYSTEM_PROMPT, userContent)`.
- No schema, DB, or UI changes for 6.1.

---

## 2) Build / Typecheck

- **Typecheck:** `npm run typecheck` — **PASSED** (exit code 0).
- **Build:** Run `npm run build` locally; ensure it completes successfully.

---

## 3) Generate a new brief (manual)

- Use a **case with multiple queries** and **mixed evidence** (results, saved links, notes if possible).
- **Trigger brief generation from the UI** (Build Forensic Brief on the case page).
- After generation, open the new brief (view in Sheet) and optionally export to PDF.

---

## 4) Verify analyst-style output (manual checklist)

Use the generated brief JSON (and rendered view) to confirm:

| Check | What to verify |
|-------|----------------|
| **executive_overview** | NOT a topic list; NOT a “Query 1 / Query 2” recap; reads like an analyst assessment (facts → appraisal). |
| **Cross-query synthesis** | working_timeline, key_entities, contradictions_tensions, verification_tasks use evidence from more than one query/source where possible; not single-query-only. |
| **What’s missing** | verification_tasks (and/or executive_overview) explicitly mention gaps, unverified claims, or missing evidence. |
| **What would disprove** | At least one contradiction/tension or verification_task is framed as a falsification test (e.g. “If X is found, it would contradict Y” or “would weaken…”). |
| **Citations** | Every source_id in working_timeline exists in evidence_index; no invented evidence IDs. |

---

## 5) Regression — old brief (manual)

- Open an **older brief** already stored in the DB (legacy contradictions_tensions only, or any pre-6.1 brief).
- Confirm it **still renders** in the brief viewer (Sheet) and **exports to PDF** with no errors.

---

## REPORT BACK (fill after running the test)

### Executive overview (1–2 paragraphs, redacted)

*Paste 1–2 paragraphs from the newly generated brief’s `executive_overview` (redact names/sensitive content). Confirm it is analyst-style (no topic list, no Query 1/2 recap).*

Example placeholder:

```
[Paragraph 1 — facts and context from the evidence, redacted.]
[Paragraph 2 — appraisal, gaps, or significance, redacted.]
```

---

### Example verification_task (“what would disprove”)

*Paste one verification_task (or contradiction) that is framed as a falsification test (“If X is found, it would contradict/weaken Y”).*

Example placeholder:

```json
{
  "task": "If [primary document X] were located and showed [contrary fact], it would contradict the current interpretation that [Y]. Obtain or request X to test this.",
  "priority": "high",
  "suggested_queries": ["..."]
}
```

---

### Confirmation: old brief still renders

*Confirm after opening an older brief from the DB:*

- [ ] Brief viewer (Sheet) opens with no errors.
- [ ] PDF export completes with no errors.
- [ ] Legacy contradictions (if any) display correctly.

---

## Summary

| Item | Status |
|------|--------|
| Code location (BRIEF_SYSTEM_PROMPT + userContent only) | Confirmed |
| Typecheck | Passed |
| Build | Run locally |
| New brief generation | Manual (UI) |
| Analyst-style checks | Manual checklist above |
| Old brief regression | Manual confirmation above |

Complete the “Report back” section after generating a new brief and opening an old one.
