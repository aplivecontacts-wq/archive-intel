# Brief Scoring System (Instrument Panel)

The **Instrument Panel** on the case page shows a **Score (0–100)** and **Grade (A/B/C/D/F)** for the current brief. This document describes how the score is computed and how each part of the case contributes.

## Total score (0–100)

The score is the sum of six components, capped at 100:

| Component | Max points | What it measures |
|-----------|------------|------------------|
| **A) Timeline coverage** | 25 | Share of timeline events that have **≥2 source refs** (multi-source support). |
| **B) Contradictions** | 20 | Fewer unresolved contradictions → more points (0 = 20, 1–2 = 15, 3–4 = 10, 5+ = 0). |
| **C) Critical gaps** | 15 | Fewer critical evidence gaps → more points (0 = 15, 1–2 = 10, 3–4 = 5, 5+ = 0). |
| **D) Credibility mix** | 20 | **Tiered** source credibility: each evidence entry gets a weight 0–1; score = (average weight) × 20. |
| **E) Hypothesis balance** | 20 | Share of hypotheses that have **evidence_against** (counter-evidence) filled. |
| **F) Evidence depth** | 5 | At least one **evidence_strength** theme with **≥1 supporting_ref** (single ref is enough). |

**Grade bands:** 90–100 A, 80–89 B, 70–79 C, 60–69 D, &lt;60 F.

---

## Credibility (D) — how sources are weighted

Credibility is **tiered**, not binary. Each evidence_index entry gets a **weight** from a single shared module (`lib/ai/brief-schema.ts`). The credibility score = (sum of weights / number of entries) × 20.

### Weight rules (0–1 per entry)

- **1.0 (full):**  
  - **Analyst-marked “Official source”** (checkbox on saved link) — e.g. leaked tax doc, court filing.  
  - **Primary** source_tier (P button).  
  - **Official URL:** .gov, .gov.xx, .mil, .europa.eu, un.org, state.gov, who.int.  
  - **Established news URL:** nytimes, bbc, reuters, ap, and an expanded list (e.g. afp, dw, cbc, abc.net.au, nature, statnews, etc.).

- **0.8:** **Secondary** source_tier (S button).

- **0.5:** **Other** — URL present but not official, news, or social (e.g. specialist or regional sites).

- **0.35:** **Social** — twitter, x, facebook, youtube, reddit, linkedin, etc.

- **0.3:** **Internal** — note or confidential type.

- **0.2:** **Unverified** — no URL.

So: non-.gov sources **do** contribute. Marking a link as **Official source** or **Primary** gives it full weight; **Secondary** gives strong partial weight.

---

## What feeds into the score

| Input | Where it’s used |
|-------|------------------|
| **Saved links** (URL, source_tier, official_source) | Evidence_index → credibility (D). |
| **Extract key facts** (heuristic) + **Analyze** (AI) | Payload to brief → timeline, entities, evidence_index; no separate section — digested into existing brief. |
| **Notes** | Payload → evidence_index (internal weight) and synthesis. |
| **Working timeline** + source_refs | Timeline coverage (A). |
| **Contradictions_tensions** | Contradictions (B). |
| **Critical_gaps** | Gaps (C). |
| **Hypotheses** + evidence_against | Hypothesis balance (E). |
| **Evidence_strength** + supporting_refs | Evidence depth (F); ≥1 ref per theme is enough. |

---

## Single source of truth

- **Classification and weight:** `classifyEvidenceEntry()` and `getCredibilityWeight()` in `lib/ai/brief-schema.ts`. Used by integrity score, source credibility summary, and coherence alerts.  
- **Score:** `computeIntegrityScore()` in `lib/integrity-score.ts` (uses the above).  
- **Summary text:** `computeSourceCredibilitySummary()` in `lib/ai/brief-schema.ts` (same weights/categories).

---

## Drivers and weak points

The Instrument Panel shows up to 4 **drivers** (strengths) and 4 **weak points** (improvement areas), e.g.:

- **Drivers:** “Strong share of official, news, or analyst-marked primary/official sources”; “Evidence themes have supporting sources”; etc.  
- **Weak points:** “Few official, news, or analyst-marked primary sources; consider marking key sources”; “No evidence themes with supporting refs”; etc.

Primary/secondary and analyst-marked official are always framed as **strengths**, not “weak”.
