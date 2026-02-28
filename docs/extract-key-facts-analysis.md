# Extract Key Facts — Full Analysis

## What it is

**Extract Key Facts** is an optional, on-demand enrichment for **saved links** inside a **case**. It fetches the link’s URL, pulls plain text from the page, runs heuristic extraction (no AI), and stores a short **summary**, **key claims**, **key entities**, and **key dates** on the saved link.

---

## What it’s for

- **Quick skim** of a saved source without opening the page.
- **Case cohesion**: surface main points and entities from primary/secondary sources.
- **Downstream use**: `extracted_text` is used by **case entities rebuild** (`/api/cases/[caseId]/entities/rebuild`) to build the case’s entity list from notes + snippets + extracted text.

It is **manual**: the user clicks a button per saved link. It does **not** run automatically when a link is saved.

---

## Where it shows

1. **Saved tab** (Results area)
   - Tab label: **SAVED (N)** where N = count of scoped saved links.
   - Only when viewing a **case** (`caseId` present); the extract button is not shown without a case.

2. **Each saved link card** (`SavedLinkCard` in `components/results-tabs.tsx`)
   - **Extract button**: FileText icon; tooltip “Extract key facts”. Click triggers POST to the extract API. While running, icon becomes a loading spinner.
   - **After success**: A block under the URL shows:
     - **Summary**: first ~400 characters of extracted text (line-clamp-2).
     - **Key claims**: toggle “Key claims (3)” that expands to a bullet list of up to 3 sentence-like claims.
   - **key_entities** and **key_dates** are stored in the DB and in the API response but are **not** rendered in the Saved tab UI.
   - **extraction_error**: Stored in the DB when extraction fails; the **card does not show it**. The user only sees the **toast** from the API response (e.g. “This site is rate-limiting…” or “Extraction failed”).

---

## How it works (end-to-end)

### 1. User action

- User is on a **case** page → Results → **Saved** tab.
- User clicks the **Extract key facts** (FileText) button on a saved link.

### 2. Client (`components/results-tabs.tsx`)

- `onExtract(savedLinkId)` is called (only when `caseId` is set).
- `POST /api/cases/{caseId}/saved-links/{savedLinkId}/extract` with no body.
- Client timeout: 50 seconds (AbortController). On timeout → toast “Request timed out…”
- On success: `toast.success('Key facts extracted')`, then `fetchSaved()` to refresh the list.
- On error: `toast.error(data.error ?? 'Extraction failed')` (server returns 200 with `{ ok: false, error: "…" }`).

### 3. Server: extract route

**File:** `app/api/cases/[caseId]/saved-links/[savedLinkId]/extract/route.ts`

- **Auth**: Clerk `userId` required.
- **Authorization**: Case must exist and belong to user; saved link must belong to user and (if `case_id` set) to that case.
- **URL**: Read from `saved_links.url` for that `savedLinkId`.

**Fetch phase**

- Fetch the **live URL** (browser-like User-Agent, Accept, Accept-Language).
- **Retries**: On 429 or 503, retry up to 3 times with backoff (2s base, max 10s). Per-request timeout 12s; total fetch phase deadline 45s.
- **If still 429**: Try to get an **archived** snapshot:
  - Use same logic as the app’s wayback flow: **canonicalize** URL, then:
    - `availability`: `https://archive.org/wayback/available?url=...`
    - If no result: same URL without fragment for availability.
    - If still none: **CDX** with same params/filter as wayback route → newest capture.
  - If a snapshot URL is found, **fetch that** (archive.org) and use its HTML for extraction.
  - If no snapshot or snapshot fetch fails → store and return the friendly message: “This site is rate-limiting. No archived copy was found. Try again in a few minutes or add this page from the Archive tab.”

**Extract phase**

- **Strip HTML**: Remove script/style tags, then all tags, normalize whitespace.
- **Truncate**: Max 50KB UTF-8 of plain text.
- **Heuristic facts** (no AI):
  - **summary**: First 400 characters (or 200 if no leading summary).
  - **key_claims**: First 3 “sentences” (split on `.\s+`), length > 20, capped with a period.
  - **key_dates**: Up to 5 matches of `(19|20)YY` or `YYYY-MM` or `YYYY-MM-DD`.
  - **key_entities**: Up to 10 capitalized phrases (e.g. “Word” or “Word Word Word”) 2–40 chars.

**Persist**

- **On success**: Update `saved_links` with `extracted_text`, `extracted_at`, `extraction_error = null`, `extracted_facts` (JSON: key_claims, key_entities, key_dates, summary).
- **On failure**: Update `saved_links` with `extraction_error = errMsg`, `extracted_at = now`, `extracted_text = null`, `extracted_facts = null`. Response 200 with `{ ok: false, error: errMsg }`.

---

## Database

**Table:** `saved_links`  
**Migration:** `supabase/migrations/20260220120000_add_extraction_to_saved_links.sql`

| Column             | Type       | Purpose |
|--------------------|------------|--------|
| `extracted_text`   | `text`     | Plain text from page (max 50KB stored). |
| `extracted_at`     | `timestamptz` | When extraction was last run. |
| `extraction_error` | `text`     | Error message if fetch or extract failed. |
| `extracted_facts`   | `jsonb`    | `{ key_claims, key_entities, key_dates, summary }`. |

All four are optional; extraction is additive and can be re-run (each run overwrites these fields).

---

## API contract

- **Endpoint:** `POST /api/cases/[caseId]/saved-links/[savedLinkId]/extract`
- **Auth:** Required (Clerk).
- **Success:** `200`, `{ ok: true, savedLinkId, extracted_at, extracted_facts }`.
- **Failure (e.g. rate limit, no archive):** `200`, `{ ok: false, error: "user-facing message" }`. DB is still updated with `extraction_error` and cleared facts.
- **Other errors:** 400/401/403/404 as appropriate; 200 with `ok: false` for business logic failures so the client can show `data.error`.

---

## Related code (no changes to archive behavior)

- **Wayback resolution** in the extract route uses the **same** canonical URL and availability/CDX logic as the app’s wayback flow but calls **archive.org** directly from the extract route (no self-call to `/api/wayback`). No changes were made to `app/api/wayback/route.ts`, `wayback/available`, or `wayback/cdx`.
- **Case entities:** `app/api/cases/[caseId]/entities/rebuild/route.ts` uses `extracted_text` (and snippet/title) from saved links when rebuilding case entities.
- **Saved list:** `GET /api/saved` returns `saved_links` with `select('*')`, so all extraction fields are included and passed to the Saved tab.

---

## Summary

| Aspect        | Detail |
|---------------|--------|
| **What**      | On-demand “extract key facts” for a saved link in a case. |
| **Where**     | Case → Results → **Saved** tab; per-card Extract (FileText) button and result block (summary + key claims). |
| **How**       | Fetch URL (with 429 → archive.org fallback), strip HTML, heuristic extraction, store in `saved_links`. |
| **Displayed** | Summary + key claims on the card; key_entities/key_dates stored but not shown; extraction_error only in toast, not on card. |
| **Used by**   | User reading; case entities rebuild (uses `extracted_text`). |
