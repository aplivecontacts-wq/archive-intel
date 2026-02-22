# Phase 7.1 — Contradiction Detection Upgrade (Prompt curation context)

Use this when curating the prompt and schema for **structured conflicts** and "This does not add up because…" moments.

---

## 1. Current state (what to replace)

### Schema (`lib/ai/brief-schema.ts`)

```ts
export interface BriefContradictionsTensions {
  issue: string;
  details: string;
  source_refs: string[];
}
```

- **issue**: short label (e.g. "Conflicting dates")
- **details**: free-text explanation
- **source_refs**: array of evidence_index IDs

No structure for *what* contradicts *what*, *why it matters*, or *what to do about it*.

### Brief system prompt (`app/api/cases/[caseId]/brief/route.ts`)

Relevant excerpts:

- **PASS 2**: "Surface tensions, contradictions, and competing narratives."
- **PASS 2**: "Convert findings into timeline entries, entities, **contradictions**, and verification tasks."
- **Requirement 2**: "contradictions … must connect evidence from multiple queries, notes, saved links, or results."
- **Requirement 4**: "Identify what discovery would contradict or materially weaken … Include these in **contradictions_tensions** and/or verification_tasks."
- **Schema section**:  
  `contradictions_tensions entries: issue, details, source_refs`

So today the model is only asked for a loose `issue` + `details` + refs, not a structured A-vs-B conflict.

### Where contradictions are used

| Location | What it does |
|----------|----------------|
| **UI** `components/case-briefs.tsx` | Renders "Contradictions / Tensions" card: for each item, shows `c.issue` (bold) and `c.details` (small). No source_refs in UI. |
| **PDF** `lib/pdf/brief-to-pdf.ts` | Section "Contradictions / Tensions": one line per item = `issue: details [refs]`. |
| **Validation** `lib/ai/brief-schema.ts` | `validateBriefJson()` checks `contradictions_tensions` is array; each element has `issue` (string), `details` (string), `source_refs` (array). |

---

## 2. Target state — Structured conflicts (Phase 7.1)

Replace the weak shape with **structured conflicts** that support "This does not add up because…" moments.

### Proposed schema (for prompt + TypeScript)

Each **contradictions_tensions** entry becomes a **structured conflict**:

| Field | Type | Purpose |
|-------|------|---------|
| **issue_type** | string | One of: `date` \| `count` \| `identity` \| `location` \| `claim` (or allow "other"). Tells the analyst *kind* of conflict. |
| **issue** | string | Short headline (e.g. "Conflicting dates for the same event"). Keep for backward compatibility / display. |
| **statement_a** | string | First assertion (what one source/evidence says). |
| **statement_a_refs** | string[] | Evidence IDs supporting statement A. |
| **statement_b** | string | Conflicting assertion (what another source says). |
| **statement_b_refs** | string[] | Evidence IDs supporting statement B. |
| **why_it_matters** | string | Analyst-facing: impact on the case, credibility, or conclusions ("This does not add up because…"). |
| **resolution_tasks** | string[] | Concrete steps to resolve or test the conflict (e.g. "Obtain primary record X", "Confirm identity of Y"). |

- All `*_refs` IDs must exist in **evidence_index** (same as today).
- **Deliverable**: Each entry should be a clear "This does not add up because…" moment: two stated positions (A vs B), with refs, plus why it matters and what to do next.

### Prompt direction (for curation)

- In **PASS 2**, require: identify *pairs* of conflicting assertions (statement A vs statement B), classify by **issue_type** (date / count / identity / location / claim), and attach refs to each side.
- Require a short **why_it_matters** (impact) and **resolution_tasks** (next steps).
- In the **SCHEMA RULES** section, replace the current `contradictions_tensions entries` bullet list with the new field list above.
- Optionally add one or two **examples** of a structured conflict in the prompt (e.g. issue_type `date`, statement_a vs statement_b, why_it_matters, resolution_tasks) so the model sees the desired format.
- Keep **evidence_index** and "no fabrication" rules: every ref in statement_a_refs and statement_b_refs must exist in evidence_index.

---

## 3. Files to change (implementation checklist)

| File | Change |
|------|--------|
| **lib/ai/brief-schema.ts** | Extend `BriefContradictionsTensions` with: `issue_type`, `statement_a`, `statement_a_refs`, `statement_b`, `statement_b_refs`, `why_it_matters`, `resolution_tasks`. Keep `issue` (and optionally `details`) for display/backward compatibility if desired; validator must allow and validate new fields. |
| **app/api/cases/[caseId]/brief/route.ts** | Update BRIEF_SYSTEM_PROMPT: (1) PASS 2 and analytical requirements to ask for structured A-vs-B conflicts and "This does not add up because…"; (2) SCHEMA RULES section to define the new contradictions_tensions entry shape; (3) optional example(s). |
| **components/case-briefs.tsx** | In the "Contradictions / Tensions" card, render the new structure: issue_type badge, issue, Statement A (with refs), Statement B (with refs), "Why it matters", and "Resolution tasks" list. Keep readable when some fields are empty for older briefs. |
| **lib/pdf/brief-to-pdf.ts** | In "Contradictions / Tensions" section, output structured conflict: issue_type, issue, statement_a [refs], statement_b [refs], why_it_matters, resolution_tasks (e.g. one block per conflict, with line breaks). |

---

## 4. Validation notes

- **issue_type**: restrict to a fixed set (e.g. `date` | `count` | `identity` | `location` | `claim` | `other`) in both schema and prompt.
- **statement_a_refs** and **statement_b_refs**: arrays of strings; each must be in evidence_index (same check as current source_refs).
- **resolution_tasks**: array of strings (can be empty).
- Backward compatibility: if you keep `issue` and `details`, existing briefs still validate; UI and PDF can show "Statement A/B" only when present, otherwise fall back to issue/details.

---

## 5. Example structured conflict (for prompt or docs)

```json
{
  "issue_type": "date",
  "issue": "Conflicting dates for acquisition event",
  "statement_a": "Document X states the acquisition closed on 2020-03-15.",
  "statement_a_refs": ["s1", "r2"],
  "statement_b": "Press release Y states the deal closed in Q2 2020 (April–June).",
  "statement_b_refs": ["r5"],
  "why_it_matters": "This does not add up because the exact close date affects liability and disclosure obligations.",
  "resolution_tasks": [
    "Obtain signed closing agreement or board minute",
    "Confirm whether 'close' in document X means signing or funding"
  ]
}
```

Use this (or a shorter variant) in the system prompt as the target format so the model produces "lethal" contradiction detection instead of vague issue + details.
