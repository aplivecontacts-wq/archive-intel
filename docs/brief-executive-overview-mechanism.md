# How Executive Overview Works (and Why Others Show "None")

## What Made Executive Overview Disappear

A **strict, negative** prompt line was added:

- "working_timeline, key_entities, and contradictions_tensions **must NOT be empty** when the evidence supports at least one entry..."
- "Empty arrays... are **only acceptable when** there is literally no evidence..."

That likely caused the model to change its output (e.g. alter structure, omit keys, or produce invalid JSON) or validation to fail, so the whole brief failed to save or executive_overview was no longer returned as a string.

## What Brought It Back

**Reverting** that paragraph removed the strict negative constraint. The model returned to producing valid JSON with `executive_overview` as a string.

## How the Executive Overview Mechanism Works

| Layer | Behavior |
|-------|----------|
| **Prompt** | Listed as required key; **positive** guidance only: "The executive_overview must read like a professional assessment" (ANALYST TONE). Also "Surface these in: executive_overview, verification_tasks." No "must NOT be empty" style rule. |
| **Validation** (`brief-schema.ts`) | **Coerce, never throw**: `if (typeof exec !== 'string') { obj.executive_overview = exec == null ? '' : String(exec); }` So we always end up with a string. |
| **Client** | `normalized = { ...briefJson, working_timeline: ensureArray(...), ... }` — executive_overview is **never overwritten**; it comes from the spread. |
| **Render** | Show when `typeof bj.executive_overview === 'string'`. With coercion, we always have a string to show. |

So: **positive prompt + validation coercion + client doesn’t overwrite** = executive overview always appears.

## Why Working Timeline, Key Entities, etc. Show "None"

| Layer | Behavior |
|-------|----------|
| **Prompt** | Required keys, but no positive “include at least one when…” for these arrays (unlike verification_tasks, which has “REQUIRED… MUST be an explicit falsification test” and “Output multiple verification_tasks”). |
| **Validation** | Arrays must exist and be arrays; **empty array is valid**. No coercion from `[]` to non-empty. |
| **Client** | Preserves whatever arrays the API sends; `ensureArray` returns `[]` when model sends `[]`. |
| **Render** | Show list when `length > 0`, else "None." So when model returns `[]`, we show "None." |

So: **no coercion for arrays** + **model often returns []** = sections show "None."

## Saved Link Notes (Different Source)

Saved link notes in the viewer do **not** come from `brief_json`. They come from the GET response field `saved_links_with_notes`, built from `saved_links` (and `saved_link_notes`) for the case. If it shows "None", either the case has no saved links or the API/client isn’t returning them. Prompt changes to the brief do not affect this.

## Applying the Mechanism to the Other Sections

- **We cannot coerce** empty arrays into non-empty in validation without inventing data.
- We **can** mirror the executive_overview prompt style: **positive, descriptive** guidance (“should list…”, “include at least one when…”) instead of negative (“must NOT be empty”). Same style as “The executive_overview must read like…” and “verification_tasks must include BOTH…”.
- So: add clear, positive instructions that working_timeline, key_entities, and contradictions_tensions should be populated with at least one entry when the evidence supports it, without any “must NOT be empty” or “only acceptable when” wording.
