# Phase 5.3 — UI Hookup Context (for prompt building)

Use this when writing a prompt for Phase 5.3: **Build Forensic Brief button, brief list (v1, v2…), view brief in-app, download PDF per version.**

---

## 1. Where things live

- **Case page:** `app/app/cases/[caseId]/page.tsx`
- **SearchBar (and EXECUTE button):** `components/search-bar.tsx` — the form has an "EXECUTE" button (label: `loading ? 'RUNNING...' : 'EXECUTE'`).
- **Placement for "Build Forensic Brief" button:** In the case page, **above** the SearchBar. The SearchBar is inside a `Card` → `CardContent`. So add the new button **inside that same CardContent, above** the `<SearchBar ... />` (e.g. a row with "Build Forensic Brief" then the existing form below). Do not change SearchBar itself; add the button in the case page.

---

## 2. APIs (already implemented)

| Action | Method | URL | Response |
|--------|--------|-----|----------|
| Generate brief | POST | `/api/cases/[caseId]/brief` | `{ briefId, version_number }` |
| List briefs | GET | `/api/cases/[caseId]/briefs` | `{ briefs: Array<{ id, case_id, clerk_user_id, version_number, brief_json, evidence_counts, created_at }> }` — ordered by `version_number` desc. |
| Get one brief | GET | `/api/cases/[caseId]/briefs/[briefId]` | `{ brief }` (same shape as one list item). |

All require Clerk auth (cookies). Use `credentials: 'include'` for fetch.

---

## 3. Brief data shape (for display and PDF)

Each brief has:

- **id** (uuid)
- **version_number** (1, 2, 3…)
- **created_at** (ISO string)
- **brief_json** (object):
  - **executive_overview** (string)
  - **evidence_index** — `Record<string, { type?, description?, url? }>`
  - **working_timeline** — `Array<{ time_window, event, confidence, basis, source_ids }>`
  - **key_entities** — `Array<{ name, type, source_refs }>`
  - **contradictions_tensions** — `Array<{ issue, details, source_refs }>`
  - **verification_tasks** — `Array<{ task, priority, suggested_queries }>`
- **evidence_counts** (optional) — `{ queries, results, notes, saved_links, wayback_results }`

Types are in `lib/ai/brief-schema.ts` (BriefJson, etc.).

---

## 4. UI patterns in this app

- **Next.js 14** App Router, **React**, **Tailwind**, **shadcn/ui** (e.g. `components/ui/button.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx`, `scroll-area.tsx`).
- Case page uses **Card**, **CardHeader**, **CardTitle**, **CardDescription**, **CardContent**, **Button**.
- Styling: emerald theme (`text-emerald-700`, `border-emerald-200`, `bg-emerald-600`), **font-mono** for titles/labels.
- Toasts: `toast.success()` / `toast.error()` from `sonner`.
- **Sheet** or **Dialog** are good for “view brief in-app” (scrollable content).

---

## 5. What Phase 5.3 should add (minimal)

1. **Build Forensic Brief button**  
   - Above the SearchBar/EXECUTE on the case page.  
   - On click: POST `/api/cases/[caseId]/brief`, then refresh brief list (and optionally show toast).  
   - Disable while request in flight; show loading state if desired.

2. **Brief list (v1, v2…)**  
   - Fetch GET `/api/cases/[caseId]/briefs` (e.g. on case load and after generating).  
   - Show a list of versions: v1, v2, v3… (use `version_number` and optionally `created_at`).  
   - Each row/item: **view in-app** action and **download PDF** link.  
   - Place this list somewhere sensible (e.g. same card as the button, or a small “Briefs” card/section).

3. **View brief in-app**  
   - When user chooses “view” for a version: fetch GET `/api/cases/[caseId]/briefs/[briefId]`, then show the brief (executive_overview, timeline, entities, etc.) in a **Sheet** or **Dialog** (scrollable).  
   - Use `brief.brief_json` for content; no need to change the API.

4. **Download PDF per version**  
   - Each list item has a “Download PDF” (or “PDF”) link.  
   - Options:  
     - **A)** Client-side: render brief content into a hidden div or use a lib (e.g. `jspdf`, `@react-pdf/renderer`) to build a PDF and trigger download.  
     - **B)** Server: add GET `/api/cases/[caseId]/briefs/[briefId]/pdf` that returns `Content-Type: application/pdf` and a blob; the link is that URL (with auth handled via cookie or a short-lived token).  
   - Filename suggestion: `brief-v{version_number}.pdf` or include case title.

---

## 6. What not to change

- Archive/CDX/Wayback, saved_links, query generation/grouping, Stripe/webhooks, auth flows.
- Existing brief APIs (only add UI that calls them; optional new PDF endpoint if chosen).
- SearchBar or other existing case layout except adding the button and brief list/view/PDF.

---

## 7. File hints

- **Case page:** `app/app/cases/[caseId]/page.tsx` — add state for briefs list, selected brief for view, loading; add the button, list, and view (Sheet/Dialog); wire fetch for list + generate + single brief.
- **Optional:** New component e.g. `components/brief-list.tsx` or `components/case-briefs.tsx` for the list + view + PDF links to keep the case page clean.
- **Optional:** New API route for PDF: `app/api/cases/[caseId]/briefs/[briefId]/pdf/route.ts` if you choose server-side PDF.

---

## 8. One-line summary for your prompt

Phase 5.3: On the case page, add a “Build Forensic Brief” button above the SearchBar/EXECUTE; add a brief list (v1, v2…) with “view in-app” (Sheet/Dialog) and “download PDF” per version; use existing GET/POST brief APIs; optional server route for PDF or client-side PDF generation; minimal UI only, no changes to archive/saved/queries/Stripe/auth.
