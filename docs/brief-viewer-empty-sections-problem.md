# Brief Viewer: Sections Show "None" Despite Data — Problem Brief

Use this to curate a prompt for debugging or fixing the issue.

---

## 1. Problem We Are Facing

**Symptom:** In the forensic brief viewer (Sheet that opens when you click "View" on a brief), these sections **always show "None."** even when the user expects content:

- **Working Timeline**
- **Key Entities**
- **Contradictions / Tensions**
- **Evidence Strength (Matrix)**
- **Saved link notes (evidence)**

Only **Executive Overview** and **Verification Tasks** show real content. The rest render the placeholder "None."

**Unclear so far:** Whether the data is (a) never stored, (b) stored but not returned correctly by the API, or (c) returned but not read correctly by the client.

---

## 2. Architecture (Data Flow)

1. **Generation (POST `/api/cases/[caseId]/brief`)**
   - Builds a `payload` (case, queries, results_by_query, notes_by_query, saved_links, counts).
   - Calls `generateStructuredJson(BRIEF_SYSTEM_PROMPT, userContent)` (OpenAI) → returns `briefJson`.
   - Validates with `validateBriefJson(briefJson)` → `validated` (must have `working_timeline`, `key_entities`, `contradictions_tensions`, `verification_tasks` as arrays; `evidence_strength` optional).
   - Inserts into Supabase: `case_briefs` with `brief_json: validated` (column type **jsonb**).
   - File: `app/api/cases/[caseId]/brief/route.ts`.

2. **Fetch for View (GET `/api/cases/[caseId]/briefs/[briefId]`)**
   - Loads one row: `supabaseServer.from('case_briefs').select('*').eq('id', briefId).eq('case_id', caseId).eq('clerk_user_id', userId).maybeSingle()`.
   - Also loads `saved_links` for the case and their notes from `saved_link_notes`.
   - Returns `NextResponse.json({ brief, saved_links_with_notes })`.
   - File: `app/api/cases/[caseId]/briefs/[briefId]/route.ts`.

3. **Client (Brief Viewer)**
   - On "View" click: `fetch(`/api/cases/${caseId}/briefs/${brief.id}`)` → `data = await res.json()`.
   - `raw = data.brief`; `briefJson = raw.brief_json`.
   - **Normalization:** If `brief_json` is a string, parse (and repeat until not a string). If null/not object, use `{}`. Then `ensureArray(snake, camel)` for: `working_timeline`, `key_entities`, `contradictions_tensions`, `verification_tasks`, `evidence_strength` (reads both snake_case and camelCase; if value is string, `JSON.parse` and use if array).
   - `setViewBrief({ ...raw, brief_json: normalized })`.
   - Render: `bj = viewBrief?.brief_json`; sections render `bj.working_timeline`, `bj.key_entities`, etc. If array length > 0 show list; else show "None."
   - File: `components/case-briefs.tsx` (handleView ~lines 103–157; render ~lines 297–530).

4. **Database**
   - Table: `case_briefs`; column `brief_json jsonb NOT NULL`.
   - Migration: `supabase/migrations/20260212160000_create_case_briefs.sql`.

---

## 3. What We Did So Far (Without Fixing the Issue)

- **Always show all sections:** Working Timeline, Key Entities, Contradictions/Tensions, Verification Tasks, Evidence Strength, Saved link notes are always rendered; when empty we show "None." so the structure is visible.
- **Normalize `brief_json` on load:**
  - Parse `raw.brief_json` if it’s a string (loop to handle double-encoded JSON).
  - If null or not an object, use `{}`.
  - For each of `working_timeline`, `key_entities`, `contradictions_tensions`, `verification_tasks`, `evidence_strength`: use `ensureArray(snake, camel)` so we accept both snake_case and camelCase and parse string values as JSON arrays.
  - Set `viewBrief` with `brief_json: normalized`.
- **Saved link notes section:** Always visible; shows "None." when `saved_links_with_notes` is empty (that list comes from the GET response, not from `brief_json`).

So: UI always shows sections 1–7; client normalizes `brief_json` for string/camelCase/stringified arrays. Despite that, timeline, entities, contradictions, evidence strength, and saved link notes still show "None."

---

## 4. What Might Be Needed (Hypotheses)

1. **Verify what is actually stored**
   - Inspect `case_briefs.brief_json` in Supabase (e.g. SQL or Dashboard) for a recent brief.
   - Confirm whether `working_timeline`, `key_entities`, `contradictions_tensions`, `evidence_strength` are present and non-empty arrays in the stored JSON.

2. **Verify what the API returns**
   - Call GET `/api/cases/[caseId]/briefs/[briefId]` (with auth) and inspect `response.brief.brief_json`.
   - Check type (object vs string) and presence/length of the same keys. If the server returns a string, confirm the client parse path is hit (and that the parsed object has those arrays).

3. **Supabase jsonb behavior**
   - In Node (Supabase JS client), jsonb is usually returned as a plain object. In some setups it can be returned as a string; the client already parses strings. Confirm actual behavior in this project (e.g. by logging `typeof data.brief.brief_json` and `Object.keys(data.brief.brief_json)` in the API route or client).

4. **AI output vs validation**
   - If the model sometimes returns empty arrays for those sections, validation still passes and we store empty arrays — so the viewer would correctly show "None." Fix would be prompt/generation so the model always fills those sections when evidence exists.
   - If the model returns non-empty arrays but they are altered before insert (e.g. by Supabase or by our code), that would explain missing content and needs a code path check (insert payload and DB content).

5. **Saved link notes**
   - This block is populated from `saved_links_with_notes` (saved links for the case + their notes), not from `brief_json`. "None." here means: no saved links for this case in `saved_links`, or the GET didn’t return them. Verify: case has saved links with `case_id` set; GET response includes `saved_links_with_notes` with length > 0.

6. **Response size / serialization**
   - If `brief_json` is very large, confirm that NextResponse.json() and the client don’t truncate or drop parts of the payload. (Less likely if Executive Overview and Verification Tasks are large and still show.)

---

## 5. Key Files and Locations

| What | Where |
|------|--------|
| Generate brief, call AI, validate, insert | `app/api/cases/[caseId]/brief/route.ts` |
| Fetch single brief + saved_links_with_notes | `app/api/cases/[caseId]/briefs/[briefId]/route.ts` |
| Brief viewer: fetch, normalize, set state | `components/case-briefs.tsx` (handleView, ~103–157) |
| Brief viewer: render sections from bj | `components/case-briefs.tsx` (Sheet content, ~284–530) |
| Schema and validation (required/optional arrays) | `lib/ai/brief-schema.ts` |
| DB table and brief_json column | `supabase/migrations/20260212160000_create_case_briefs.sql` |

---

## 6. Suggested Next Steps for a Curated Prompt

- Add **server-side logging** in GET `/api/cases/[caseId]/briefs/[briefId]`: log `typeof brief.brief_json`, `brief.brief_json ? Object.keys(brief.brief_json) : []`, and for each of `working_timeline`, `key_entities`, `contradictions_tensions`, `evidence_strength`: `Array.isArray(...)` and `.length`. (Dev only.)
- Add **client-side logging** in handleView after normalization: log same keys and lengths (or a short summary) so we see what the client ends up with.
- **Inspect one row in DB:** e.g. `SELECT id, jsonb_typeof(brief_json) AS type, jsonb_array_length(brief_json->'working_timeline') AS tl_len, ... FROM case_briefs WHERE ... LIMIT 1;` to see stored shape and lengths.
- Once we know whether the problem is **storage**, **API response**, or **client normalization**, the fix can target that layer (generation/insert, GET route, or viewer normalization/rendering).

---

## 7. Expected vs Actual

- **Expected:** When a brief is generated and has content in working_timeline, key_entities, contradictions_tensions, evidence_strength (and the case has saved links for section 7), the viewer shows that content in each section.
- **Actual:** Those sections always show "None." (and Saved link notes shows "None.") except Executive Overview and Verification Tasks, which show content.

This document is the single reference for the problem, what was tried, and what might be needed to fix it.
