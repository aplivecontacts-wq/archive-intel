# Brief Viewer: What Was Fixed + Prompt Guide for Empty Sections

## Summary of the Problem That Was Fixed

**Symptom:** In the brief viewer (Sheet when you click "View" on a brief), **Executive Overview** sometimes disappeared and showed nothing.

**Cause:** A strict, negative prompt line was added:

- "working_timeline, key_entities, and contradictions_tensions **must NOT be empty** when the evidence supports at least one entry…"
- "Empty arrays… are **only acceptable when** there is literally no evidence to support any entry."

That wording likely made the model change its output (e.g. alter structure, omit keys, or produce invalid JSON). When that happened, either the brief failed validation and didn’t save, or the model stopped returning `executive_overview` as a string, so the overview didn’t show.

**Fix:** That paragraph was **reverted**. The prompt no longer contains "must NOT be empty" or "only acceptable when" for those arrays. Executive Overview is back because the model again returns valid JSON with `executive_overview` as a string.

**Mechanism that makes Executive Overview show:**

1. **Validation** (`lib/ai/brief-schema.ts`): `executive_overview` is **coerced** to a string if missing or wrong type — we never throw on that field. So the stored brief always has a string there.
2. **Client** (`components/case-briefs.tsx`): Normalization only overwrites the five array keys (`working_timeline`, `key_entities`, etc.). `executive_overview` is left as-is from the API.
3. **Render**: The overview block is shown when `typeof bj.executive_overview === 'string'`.

So: **coerce in validation + don’t overwrite in client** = Executive Overview is reliable.

---

## Why the Other Sections Still Don’t Pop Up

Those sections (Working Timeline, Key Entities, Contradictions/Tensions, Evidence Strength) only show content when the **model returns non-empty arrays** in `brief_json`. The pipeline is:

1. **Prompt** → model returns JSON.
2. **Validation** → requires each of those keys to be an **array**; **empty array `[]` is valid**. We do not coerce `[]` into real content (that would be fabricating data).
3. **DB** → we store whatever validated object we get (often with `[]` for those keys).
4. **GET** → returns `brief_json` as stored.
5. **Client** → normalizes and keeps those arrays; if they’re `[]`, they stay `[]`.
6. **Render** → if `array.length > 0` we show the list; otherwise we show "None."

So if the model keeps returning **empty arrays** for `working_timeline`, `key_entities`, `contradictions_tensions`, or `evidence_strength`, those sections will keep showing "None." The only way to get them to pop up is to get the model to **output at least one entry** in those arrays when the evidence supports it.

**Saved link notes** are different: they do **not** come from `brief_json`. They come from the GET response field `saved_links_with_notes` (built from `saved_links` and `saved_link_notes` for the case). So prompt changes for the brief won’t affect that section; it depends on the case having saved links (and optionally notes on them).

---

## Information for Creating Your Own Prompt

Use this when editing the brief system prompt (e.g. in `app/api/cases/[caseId]/brief/route.ts`, constant `BRIEF_SYSTEM_PROMPT`).

### What works (Executive Overview / Verification Tasks)

- **Positive, concrete instructions:** e.g. "The executive_overview must read like a professional assessment…", "verification_tasks must include BOTH: (1) at least one falsification test… (2) other verification tasks…"
- **Describe what to include**, not what to forbid: "Include…", "List…", "When X, include at least one…"
- **Tie to evidence:** "drawn from results, notes, saved links", "when the evidence supports it"

### What broke things

- **Negative, strict rules:** "must NOT be empty", "only acceptable when there is literally no evidence"
- **Absolute constraints** on other keys that can confuse the model or change its output shape

### Schema keys the model must return (snake_case)

- `executive_overview` (string)
- `evidence_index` (object; required; IDs used in timeline/entities/contradictions)
- `working_timeline` (array of objects: `time_window`, `event`, `confidence`, `basis`, `source_ids`)
- `key_entities` (array of objects: `name`, `type`, `source_refs`)
- `contradictions_tensions` (array of objects: `issue`, plus either legacy `details`/`source_refs` or structured `statement_a`, `statement_b`, `statement_a_refs`, `statement_b_refs`, `why_it_matters`, `resolution_tasks`, etc.)
- `verification_tasks` (array of objects: `task`, `priority`, `suggested_queries`)
- `evidence_strength` (optional array of objects: `theme`, `results_count`, `saved_links_count`, `wayback_count`, `note_count`, `corroboration_estimate`, `strength_rating`)

### Validation behavior

- **executive_overview:** Coerced to string if missing or wrong type (never throws).
- **working_timeline, key_entities, contradictions_tensions, verification_tasks:** Must be arrays; **empty array is valid**. No coercion from `[]` to non-empty.
- **evidence_strength:** If present, must be an array; can be omitted.

### Prompt angles you can try (keep them positive)

- **working_timeline:** e.g. "working_timeline should list chronological events from the evidence. When any result, note, or saved link supports a date or sequence, include at least one timeline entry."
- **key_entities:** e.g. "key_entities should list people, organizations, domains, and other entities. When the evidence mentions any such entity, include at least one entry."
- **contradictions_tensions:** e.g. "contradictions_tensions should list tensions or contradictions. When evidence shows conflicting claims, dates, or gaps, include at least one entry (structured conflict with statement_a, statement_b, refs, why_it_matters)."
- **evidence_strength:** e.g. "When the case has multiple thematic lines (narrative, entities, contradictions, timeline), include evidence_strength with one entry per theme (3–8 entries) so the brief shows evidence strength per theme."

Keep everything in the **"include when…" / "should list…"** style and avoid **"must NOT be empty"** or **"only acceptable when"** so the model doesn’t change structure and break Executive Overview again.

---

## Where to edit

- **Brief system prompt:** `app/api/cases/[caseId]/brief/route.ts` — constant `BRIEF_SYSTEM_PROMPT` (large string).
- **Validation (coerce/require):** `lib/ai/brief-schema.ts` — `validateBriefJson`.
- **Viewer (normalize + render):** `components/case-briefs.tsx` — `handleView` and the Sheet content that uses `bj.working_timeline`, `bj.key_entities`, etc.

Saved link notes in the viewer come from the GET response `saved_links_with_notes`, not from the brief prompt or `brief_json`.
