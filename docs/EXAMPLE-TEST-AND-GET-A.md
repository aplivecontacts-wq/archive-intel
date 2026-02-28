# Example Test + How to Get an A

## 1. Example of the (automated) test

The scoring logic is covered by **`lib/integrity-score.test.ts`**. You can run it with:

```bash
npm run test -- lib/integrity-score.test.ts
```

**What it checks:**

- **`getCredibilityWeight`**  
  - `official_source: true` → weight 1.0 (even for non-.gov URLs).  
  - `source_tier: 'primary'` → 1.0, `'secondary'` → 0.8.  
  - `.gov` URL → 1.0.  
  - Other URL (e.g. example.com) → 0.5.

- **`classifyEvidenceEntry`**  
  - When `official_source === true`, the entry is classified as `'official'`.

- **`computeIntegrityScore`**  
  - **Evidence depth:** If the brief has at least one `evidence_strength` theme with ≥1 `supporting_ref`, the “evidence depth” component gets 5 points and a driver like “Evidence themes have supporting sources” is present.  
  - **Credibility:** A brief whose only evidence has `official_source: true` gets a higher total score than the same brief with that flag false (so analyst-marked official boosts the grade).

So the test is a **unit test**: it feeds fake brief JSON into `computeIntegrityScore` and `getCredibilityWeight` and asserts the scores and drivers match the rules in `docs/SCORING-SYSTEM.md`.

---

## 2. How to get an A (in the app)

**Grade A = 90–100.** The total is the sum of six parts (capped at 100):

| Part | Max | How to maximize it |
|------|-----|---------------------|
| **Timeline coverage** | 25 | Have several timeline events, each with **≥2 source refs** (same event cited from 2+ evidence items). |
| **Contradictions** | 20 | **0** contradictions in the brief → full 20. |
| **Critical gaps** | 15 | **0** critical_gaps → full 15. |
| **Credibility** | 20 | Use high-weight sources: **Official source** checkbox, **Primary** (P), or links from **.gov / established news**. Mix in **Secondary** (S) or other URLs for partial credit. |
| **Hypothesis balance** | 20 | At least one **hypothesis** with **evidence_against** (and falsification) filled. |
| **Evidence depth** | 5 | Brief has **evidence_strength** with at least one theme that has **≥1 supporting_ref**. |

**Practical checklist:**

1. **Case setup**  
   - Give the case a clear **objective** (e.g. “Establish launch date of Voyager 1 from primary or news sources”).

2. **Evidence quality (credibility)**  
   - Save **2–3 links** that you can mark as strong:  
     - Use **Official source** for things like leaked docs, court filings, tax docs.  
     - Use **Primary (P)** for main sources; **Secondary (S)** for supporting ones.  
   - Prefer URLs that already count as strong: **.gov**, **.mil**, or **established news** (e.g. reuters.com, bbc.com, nytimes.com, apnews.com).  
   - Optional: run **Extract key facts** (and Analyze) on saved links so the brief has more to cite.

3. **Multiple refs per event (timeline)**  
   - Have **overlapping evidence**: 2+ saved links (or notes) that support the **same** facts so the AI can attach **≥2 source_refs** to timeline events.

4. **Simple, consistent story**  
   - Pick a topic where sources **agree** (e.g. one date, one event) so the model outputs **0 contradictions** and **0 critical_gaps**.

5. **Build the brief**  
   - Open **Case Briefs** and run **Build** (or Rebuild).  
   - The model will fill timeline, entities, contradictions, gaps, hypotheses, and evidence_strength.  
   - If the evidence is good and consistent, you should get **0** contradictions, **0** gaps, multiple refs per timeline event, and at least one hypothesis with evidence_against.

6. **Check the Instrument Panel**  
   - On the case page, open the **Intel Dashboard** and look at **Instrument Panel**.  
   - **Score ≥ 90** → **Grade A**.  
   - **Drivers** will show things like “Strong share of official, news, or analyst-marked primary/official sources” and “Evidence themes have supporting sources” when you’ve hit those parts.

**Step-by-step walkthrough:** For one concrete case you can run end-to-end (create case → add query → save links → mark P/Official → build brief → check Instrument Panel for A), see **`docs/SIMPLE-CASE-TEST-GET-A.md`**.

**Example flow to try:**

- Create a case: e.g. **“Voyager 1 launch date”**, objective: *“Establish the exact launch date from official or established news sources.”*  
- Add a query (e.g. quote: “Voyager 1 launch date 1977”) and run search.  
- Save **2–3** results from **NASA (.gov)** or **BBC/Reuters**; mark at least one as **Primary** (and optionally **Official source** if it’s a primary doc).  
- Optionally add a short **note** on a link or run **Extract key facts** so the brief has more to synthesize.  
- **Build** the brief.  
- Open **Instrument Panel**: you should see a high score and **Grade A** when the brief has strong credibility, multi-ref timeline, no contradictions, no gaps, and evidence depth.

For full scoring details, see **`docs/SCORING-SYSTEM.md`**.
