# Project Cheat Sheet

Quick reference: how to populate data, how things work, and rules to follow.

---

## 1. How to Populate

### Notes (multi-entry per query)

| Action | How |
|--------|-----|
| **List notes** | `GET /api/notes?queryId=<id>` → `{ notes: [...] }` |
| **Add note** | `POST /api/notes` with body (e.g. `queryId`, content). Creates a **new row**; never overwrite a single note per query. |
| **Delete note** | `DELETE /api/notes?id=<noteId>` with ownership checks. |

- Notes are **query-scoped**: one query → many notes.
- UI: `components/results-tabs.tsx` (Notes tab), `components/query-list.tsx` (indicator).

---

### Notes attachments

| Action | How |
|--------|-----|
| **Upload** | Notes tab only; `queryId` required; use `app/api/attachments/route.ts`. |
| **List** | Same API; scoped to `queryId` and `user_id`. |
| **Delete** | Delete storage object first, then DB row; if storage delete fails, keep DB row. |

- **Allowed:** PDF, PNG, JPEG, WebP. **Max size:** 25MB.
- **DB:** `note_attachments` table + `note-attachments` storage bucket.
- Attachments are **only** in the Notes flow; never store in `saved_links`.

---

### Saved links / bookmarks

| Context | How to save |
|---------|-------------|
| **Timeline (query)** | POST with `query_id: queryId` (and `case_id: caseId` when applicable). |
| **Archive tab** | POST with `query_id: queryId` and `case_id: caseId` so the save doesn’t show under other queries. |

- **API:** `app/api/saved/route.ts`. **No `upsert`** with partial unique indexes — use **select-then-insert-or-update** (find by `user_id`, `url`, `source`; for archive also `case_id`; then update or insert).
- **DELETE archive (no case):** When `source === 'archive'` and no `case_id`, filter with `.is('case_id', null)`.

---

### Wayback / Archive

- **Routes that hit archive.org:**  
  `app/api/wayback/cdx/route.ts`, `app/api/wayback/available/route.ts`, `app/api/wayback/route.ts`, `app/api/search/route.ts`.
- **Populate/use:** Call these APIs; they fetch from `web.archive.org` / `archive.org`. Do not remove or weaken `dynamic`, `cache: 'no-store'`, or `User-Agent` (see Rules below).

---

### Cases, briefs, tasks, entities

- Cases/briefs/tasks/entities have their own APIs under `app/api/cases/...`. Use those routes and the existing UI (e.g. case page, sidebar) to create and populate cases; run migrations as in `package.json` (e.g. `db:migrate:case-tasks`) when needed.

---

## 2. How It Works

### Notes flow

1. User picks a **query** (e.g. in query list).
2. Notes tab shows **all notes for that query**; label shows count: `NOTES ({notes.length})`.
3. **Add:** new note row via POST. **Delete:** one note by id via DELETE.
4. Notes rendered as NOTE 1, NOTE 2, … by display order.
5. Query list “has note” indicator: true if **any** note for that query has non-empty content (from `data.notes`).

### Saved links / bookmarks flow

1. **Scoped list:**  
   `scopedSavedLinks` = rows where `query_id === queryId` **OR** (`query_id === null` and archive with `case_id === caseId` or `null`).  
   Memo deps: `[savedLinks, queryId, caseId]`. Saved tab and badge use **only** `scopedSavedLinks.length`.
2. **Timeline bookmark:** `isSaved(url, source)` is true only when `s.query_id != null && s.query_id === queryId`.
3. **Archive bookmark:** `isArchiveSaved(url)` requires `(s.query_id === queryId || s.query_id == null)` and `(s.case_id === caseId || s.case_id == null)`.
4. **Refetch:** Call `fetchSaved()` when `queryId` or `caseId` changes.

### Attachments flow

1. Only in **Notes tab**; all operations require auth and `queryId` belonging to the user.
2. Upload validates MIME type and 25MB limit; then storage + DB insert.
3. Delete: storage first, then DB; on storage failure, do not remove DB row.

### Wayback flow

1. UI/other code calls wayback/search APIs.
2. Those routes use `fetch(..., { cache: 'no-store', headers: { 'User-Agent': '...' } })` and `export const dynamic = 'force-dynamic'` so Next.js doesn’t cache and block archive.org.

---

## 3. Rules (Do / Don’t)

### Notes (multi-entry)

- **Do:** Multi-note per query; GET returns array; POST creates new row; DELETE by id with ownership; Notes tab count = `notes.length` for selected query; query indicator from `data.notes`.
- **Don’t:** Change archive search, saved/bookmark logic, Stripe/webhooks, routing/auth/layout when editing notes.

### Notes attachments

- **Do:** Keep attachments only in Notes (queryId-scoped); enforce PDF/images and 25MB; auth and ownership on all ops; delete storage then DB; dev-only `console.error` on failures.
- **Don’t:** Store attachments in `saved_links`; change archive/CDX or bookmark/saved behavior; touch Stripe/webhooks/routing/auth for attachment work.

### Wayback / Archive API

- **Do:** In every route file that calls archive.org:  
  - `export const dynamic = 'force-dynamic';`  
  - Every `fetch()` to archive.org: `cache: 'no-store'` and a `User-Agent` header.
- **Don’t:** Remove or weaken these in the four routes listed above; add new archive fetches without `cache: 'no-store'` and `User-Agent`.

### Mobile responsive

- **Do:** Viewport `width: 'device-width'`, `initialScale: 1`; mobile = stacked/single-column, sidebar behind MENU; no fixed/min widths that force horizontal scroll; changes in layout/CSS only (`app/layout.tsx`, `app/globals.css`, case/results layout components).
- **Don’t:** Change APIs, DB, auth, archive/saved/query logic, Stripe/webhooks, or routes for responsive fixes.

### Saved links / bookmarks

- **Do:** Use `scopedSavedLinks` for Saved tab and badge; use select-then-insert-or-update (no upsert on partial unique index); scope timeline by `query_id === queryId`; scope archive by `query_id` + `case_id`; send `query_id` and `case_id` when saving from Archive; refetch when `queryId`/`caseId` changes; dev-only error logging for GET/POST/DELETE.
- **Don’t:** Use `savedLinks` instead of `scopedSavedLinks` for tab/badge; use `upsert` on partial unique index; show archive saves as “saved” for a different query.

### Rename / refactor

- **Do:** Search for old name before finishing; update every usage (JSX, props, labels, conditionals); update other files if symbol is exported or shared; complete renames only when all usages are updated.
- **Don’t:** Leave partial renames or missed references.

---

## 4. Key files

| Area | API | UI / Other |
|------|-----|------------|
| Notes | `app/api/notes/route.ts` | `components/results-tabs.tsx`, `components/query-list.tsx` |
| Attachments | `app/api/attachments/route.ts` | `components/results-tabs.tsx` (Notes tab) |
| Saved | `app/api/saved/route.ts` | `components/results-tabs.tsx` |
| Wayback | `app/api/wayback/*.ts`, `app/api/search/route.ts` | — |
| Mobile | — | `app/layout.tsx`, `app/globals.css`, case/results layout |

---

## 5. Scripts

- `npm run dev` — dev server (port 3000)
- `npm run build` / `npm run start` — production
- `npm run db:migrate:saved` — saved links migration
- `npm run db:migrate:case-id` — case ID migration
- `npm run db:migrate:case-tasks` — case tasks migration
- `npm run test` — Vitest
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint

---

*Keep this doc updated when you add new “how to populate” flows or new rules.*
