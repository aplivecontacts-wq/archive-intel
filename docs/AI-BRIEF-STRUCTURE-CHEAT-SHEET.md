# AI Brief Structure Cheat Sheet

This document describes **how each part of the forensic brief is actually structured** so the AI can output valid JSON that passes validation and matches product behavior. Use this when generating or organizing the brief.

---

## Evidence index (required)

- **Shape:** `evidence_index` is an **object** (not array). Keys are string IDs; values are `{ type?, description?, url?, source_tier? }`.
- **ID rules:** Build from payload only. No fabrication.
  - Queries: `q1`, `q2`, … (1-based). `type: "query"`, `description`: normalized_input or raw_input.
  - Saved links: `s1`, `s2`, …. `type: "saved_link"`, `description`: title + snippet; include `source_tier` from payload (`"primary"` | `"secondary"` | null).
  - Notes: `n1`, `n2`, …. `type: "note"`, `description`: first 160 chars of content.
  - Results: `r1`, `r2`, …. `type: "result"`, `description`: title + snippet; `url` when present.
- **All refs elsewhere:** Every `source_ids`, `source_refs`, `statement_a_refs`, `statement_b_refs`, `supporting_refs`, `evidence_for`, `evidence_against` in the brief **must** be keys that exist in `evidence_index`. Never use raw URLs or `query:<id>`.

---

## Working timeline (required)

- **Per entry:** `time_window` (string), `event` (string), `confidence` (`"high"` | `"medium"` | `"low"`), `basis` (`"public"` | `"note"` | `"confidential"` | `"unverified"`), `source_ids` (array of evidence_index IDs).
- **Do not output** `verified` — that is set by the user in the UI. Omit the key or use false.
- **How it works:** Each event cites 1–4 evidence_index IDs. When evidence_index entries have `source_tier: "primary"`, confidence can be higher; when only secondary or unmarked, use medium or low.

---

## Key entities (required)

- **Per entry:** `name` (string), `type` (exactly one of: `"person"` | `"org"` | `"domain"` | `"location"` | `"handle"` | `"other"`), `source_refs` (array of evidence_index IDs).
- **How it works:** People, orgs, domains, locations, handles mentioned in evidence. Each entity must cite 1–4 refs from evidence_index.

---

## Contradictions & tensions (required; use structured format only)

- **Use only the structured conflict format.** Do not output legacy format (issue + details + source_refs).
- **Per entry, all required:**  
  `issue` (string), `issue_type` (exactly one of: `"date"` | `"count"` | `"identity"` | `"location"` | `"claim"` | `"other"`),  
  `statement_a` (string), `statement_a_refs` (array of evidence_index IDs),  
  `statement_b` (string), `statement_b_refs` (array of evidence_index IDs),  
  `why_it_matters` (string; include “This does not add up because…” where it fits),  
  `resolution_tasks` (array of strings; at least one concrete action).
- **Ref rules:** statement_a_refs and statement_b_refs must reference only keys in evidence_index. Each side cites its own refs. If only one side has evidence, use e.g. statement_b: “No corroborating evidence located yet” and still provide statement_b_refs; explain the gap in why_it_matters.
- **When none:** If there are no real contradictions or tensions, output `contradictions_tensions: []`.

---

## Verification tasks (required)

- **Per entry:** `task` (string), `priority` (`"high"` | `"medium"` | `"low"`), `suggested_queries` (array of strings).
- **How it works:** Concrete next steps. At least one should be a **falsification test** when the case supports it: state the current interpretation (Y), the evidence (X) that would contradict or weaken Y, and how. These feed “Next moves” (case tasks) when the user imports from the brief.

---

## Evidence strength (optional)

- **When to include:** Only when the case has **multiple thematic lines** (narrative, entities, contradictions, timeline). 2–8 entries; omit or use a single entry when there are no distinct themes.
- **Per entry:**  
  `theme` (string),  
  `results_count`, `saved_links_count`, `wayback_count`, `note_count` (numbers),  
  `corroboration_estimate` (string, e.g. “multiple independent sources”, “single source”),  
  `strength_rating` (`"high"` | `"medium"` | `"low"`),  
  `supporting_refs` (array of evidence_index IDs; required; used to derive primary/secondary counts from evidence_index source_tier).
- **How it works:** Each entry is a **thematic line** in the case, not a query. Counts reflect evidence for that theme. primary_sources_count / secondary_sources_count can be omitted; they are derived from supporting_refs and evidence_index source_tier. High = multiple independent sources; medium = some corroboration; low = minimal or single-source.

---

## Hypotheses (optional)

- **When to include:** When the case admits **competing explanations**. 2–5 hypotheses; omit if evidence does not support competing explanations.
- **Per entry:** `statement` (string), `likelihood` (`"high"` | `"medium"` | `"low"`), `evidence_for` (array of evidence_index IDs), `evidence_against` (array of evidence_index IDs), `falsification_tests` (array of strings).
- **Ref rules:** All refs must be evidence_index IDs. Neutral language; no accusations.

---

## Critical gaps (optional)

- **When to include:** When the case has **clear missing evidence** that would change the analysis. 1–5 gaps; omit if none.
- **Per entry:** `missing_item` (string; specific, not generic “need more research”), `why_it_matters` (string), `fastest_way_to_verify` (string; one concrete action), `suggested_queries` (array of strings; copy-pasteable search patterns or targets).
- **How it works:** User knows what to do next. suggested_queries should be actionable (e.g. site:, filetype:, archive, court/docket).

---

## Collapse tests (optional)

- **When to include:** When the case has **important claims or hypotheses** that rest on specific assumptions. Stress-test the chain: if X is wrong, what collapses?
- **Per entry:**  
  `claim_or_hypothesis` (string),  
  `critical_assumptions` (array of strings),  
  `single_points_of_failure` (array of strings),  
  `what_would_falsify` (array of strings),  
  `highest_leverage_next_step` (string; one step),  
  `supporting_refs` (array of evidence_index IDs; must exist in evidence_index).
- **How it works:** Structural only; no guilt or accusation. Use neutral language.

---

## Incentive matrix (optional)

- **When to include:** When the case has **competing narratives** (e.g. Narrative A vs B) and **identifiable actors** with different stakes. 1–5 entries; omit if no meaningful competing narratives.
- **Per entry:**  
  `actor` (string), `role` (string, e.g. “source”, “subject”, “interested party”),  
  `narrative_a_incentives` (array of strings), `narrative_b_incentives` (array of strings),  
  `exposure_if_false` (array of strings),  
  `supporting_refs` (array of evidence_index IDs; may be empty []).
- **How it works:** **Strictly conditional language.** Examples: “If Narrative A is true, incentives could include…”; “Under Narrative B, this actor might benefit from…”. Do **not** assert intent, motives, or accuse. supporting_refs may be [] when the entry is purely analytical; when non-empty, every ref must be in evidence_index.

---

## Executive overview (required)

- **Shape:** Single string. Written **last**, synthesizing timeline and key_entities so the brief reads as one story.
- **How it works:** Professional assessment; neutral; evaluative; no speculation beyond evidence; clearly distinguish fact vs inference. When case objective is set, frame the situation in light of it.

---

## Sections the AI does not fill (computed server-side)

- **source_credibility_summary** — Computed from evidence_index (official/news/social/etc.). Do not invent.
- **integrity_score** — Computed from structure (score_0_100, grade, drivers, weak_points). Do not output.
- **evidence_network** — Computed (central_nodes, isolated_nodes, single_point_failures). Do not output.
- **coherence_alerts** — Computed from internal consistency. Do not output.
- **entity_summary_panel**, **evidence_summary_panel** — Filled from DB and evidence counts. Do not output.
- **changes_since_last_version** — Computed by diff vs previous version. Do not output.

---

## Required top-level keys (exactly these)

- `executive_overview`, `evidence_index`, `working_timeline`, `key_entities`, `contradictions_tensions`, `verification_tasks`.
- Do not add, remove, or rename top-level keys. Optional keys: `evidence_strength`, `hypotheses`, `critical_gaps`, `threads`, `collapse_tests`, `incentive_matrix`.

---

## Build order (recommended)

1. evidence_index (from payload: q1, s1, n1, r1…; include source_tier for saved links).  
2. working_timeline, key_entities, contradictions_tensions, verification_tasks.  
3. executive_overview last, referencing timeline and entities.

This cheat sheet reflects the actual validation in `lib/ai/brief-schema.ts` and the behavior of the brief viewer and Next moves (case tasks).
