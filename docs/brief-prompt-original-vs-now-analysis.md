# Brief Prompt: Original vs Now — Reverse-Engineering and Issues

## Your Original Prompt (What Initially Made Other Parts Work)

- **Shorter, less constrained.** No long "MANDATORY FALSIFICATION TEST" with lists of unacceptable/acceptable examples.
- **Section 4 was brief:** "WHAT WOULD DISPROVE — For major working interpretations… Include these in contradictions_tensions and/or verification_tasks." One short example. No "verification_tasks must include BOTH…"
- **verification_tasks:** Schema only — "task, priority, suggested_queries". No "REQUIRED: (1) At least one verification_tasks entry MUST be an explicit falsification test…"
- **contradictions_tensions:** Simple — "issue, details, source_refs" (legacy only). No structured-conflict (statement_a/statement_b) section.
- **No** CONTRADICTIONS / TENSIONS (STRUCTURED CONFLICTS) section.
- **No** EVIDENCE STRENGTH MATRIX or THREADS sections.
- **evidence_index:** "Keys must be stable IDs (e.g., q1, r1, n1, s1)" with no instruction on how to derive them from the payload.
- **No** "Populate working_timeline, key_entities…" paragraph.

So the model had: clear two-pass protocol, schema with required keys, and "NO FABRICATION" + "refs must exist in evidence_index", but **no** detailed falsification wording, **no** structured conflicts, and **no** explicit rule on how to build evidence_index from the payload. It could fill timeline/entities/contradictions in a simpler way (e.g. legacy details/source_refs) and still satisfy the prompt.

---

## What Changed (Now vs Then)

| Area | Then (original) | Now (current) |
|------|------------------|----------------|
| **Section 4** | Short "WHAT WOULD DISPROVE" + one example | Long "WHAT WOULD DISPROVE (MANDATORY FALSIFICATION TEST)" with unacceptable/acceptable examples and "verification_tasks must include BOTH…" |
| **verification_tasks** | Schema only | Plus "REQUIRED: (1) At least one… MUST be an explicit falsification test… (2) Also include other verification_tasks… Output multiple…" |
| **contradictions_tensions** | issue, details, source_refs | Same + full "STRUCTURED CONFLICTS" section (statement_a, statement_b, refs, why_it_matters, resolution_tasks). Validation accepts both legacy and structured. |
| **evidence_index** | "Stable IDs (e.g., q1, r1, n1, s1)" | Same text; still no mapping from payload (queries are UUIDs, results/notes nested). |
| **PASS 1** | No mention of per-link notes | Added "Each saved link may include a 'notes' array… treat these as evidence." |
| **Extra sections** | None | EVIDENCE STRENGTH MATRIX, THREADS, "Populate working_timeline, key_entities…" paragraph. |

So **now** the model gets: heavier verification_tasks/falsification requirements, more complex contradictions (structured conflicts), and the same underspecified evidence_index. It still must "not fabricate" and "refs must exist in evidence_index", but it is never told **how** to build evidence_index from the payload (payload has UUIDs and nested results_by_query / notes_by_query). So it tends to:

- Avoid or minimize evidence_index (or make it tiny).
- Then avoid timeline/entities/contradictions that need to cite evidence_index IDs.
- Output empty arrays for those sections to stay valid and non-fabricated.

Executive overview and verification_tasks still work because: overview is a string (easy), and verification_tasks can be generic tasks; both have strong positive instructions and don’t depend on evidence_index IDs.

---

## What We Did With verification_tasks

- **Left the current wording in place** so we don’t break what’s working: "REQUIRED: (1) At least one verification_tasks entry MUST be an explicit falsification test… (2) Also include other verification_tasks… Output multiple verification_tasks—both the falsification one and the rest."
- The original had only a short "include in verification_tasks" nudge. The current version is more prescriptive and is what you have now with verification_tasks showing. So we did **not** revert or shorten verification_tasks.

---

## Issues Isolated for Rework

1. **evidence_index underspecified**  
   Prompt says "stable IDs (q1, r1, n1, s1)" but payload has UUIDs and nested structure. Model doesn’t know how to mint IDs from payload.queries, payload.results_by_query, payload.notes_by_query, payload.saved_links. So it plays safe and keeps evidence_index minimal or empty → then can’t safely cite IDs in timeline/entities/contradictions.

2. **No “how to build evidence_index”**  
   Model isn’t told it can create one entry per query/saved link/note/result and how to index them (e.g. q1, q2 from queries; s1, s2 from saved_links; n1, n2 from notes_by_query; r1, r2… from results_by_query). So it doesn’t reliably populate evidence_index.

3. **Structured sections are high-risk**  
   working_timeline, key_entities, contradictions_tensions need structured, cross-referenced IDs. With "NO FABRICATION" and underspecified evidence_index, the model defaults to empty arrays to avoid mistakes.

4. **Contradictions rare by default**  
   Even when present, model hesitates; empty array is valid, so it often outputs [].

5. **Vague “populate when evidence supports”**  
   The added "Populate working_timeline, key_entities… like the executive_overview… when the case evidence allows" doesn’t tell the model **how** to create IDs or map payload → evidence_index → timeline/entities. So it doesn’t fix the root cause.

---

## Fix Applied: EVIDENCE MAPPING RULES

We added the **EVIDENCE MAPPING RULES (MAKE STRUCTURED SECTIONS EASY)** block you provided. It:

- Gives **deterministic** rules to create evidence_index IDs from the payload (q1, q2 from payload.queries; s1, s2 from payload.saved_links; n1, n2 from notes_by_query; r1, r2… from results_by_query).
- Tells the model to **build evidence_index first** from the payload, then build working_timeline (citing 1–4 evidence_index IDs in source_ids), key_entities (citing 1–4 IDs in source_refs), and contradictions_tensions only when there’s a real tension (otherwise empty array acceptable).
- Uses **positive** language ("you should map", "prefer producing a small number of conservative entries") and **no** "must not be empty", so it shouldn’t break executive overview or verification_tasks.
- Aligns with validation: working_timeline[].source_ids, key_entities[].source_refs, and contradictions_tensions (legacy or structured) all reference evidence_index IDs.

We **removed** the vague "Populate working_timeline, key_entities, and contradictions_tensions like the executive_overview…" paragraph so the deterministic evidence-mapping rules are the single source of guidance for those sections. Executive overview, verification_tasks, ANALYST TONE, NO FABRICATION, and the rest of the prompt are unchanged.
