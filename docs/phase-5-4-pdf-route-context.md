# Phase 5.4 — PDF Route Context (for prompt building)

Use this when writing a prompt for Phase 5.4: **GET /api/cases/[caseId]/briefs/[briefId]/pdf** — load brief_json, render a polished PDF, return file download.

---

## 1. Route and auth (match existing brief route)

- **Path:** `app/api/cases/[caseId]/briefs/[briefId]/pdf/route.ts` (new file: `pdf` subfolder under `[briefId]`).
- **Method:** GET only.
- **Auth and ownership:** Reuse the exact pattern from `app/api/cases/[caseId]/briefs/[briefId]/route.ts`:
  - `const { userId } = await auth();` from `@clerk/nextjs/server`. If `!userId` → 401.
  - Resolve `caseId` and `briefId` from `params`.
  - Fetch case: `cases` where `id = caseId`. If not found → 404. If `caseRow.user_id != null && caseRow.user_id !== userId` → 403.
  - Fetch brief: `case_briefs` where `id = briefId`, `case_id = caseId`, `clerk_user_id = userId`. If not found → 404.
  - Only then use `brief.brief_json` (and optional case title) for the PDF.

---

## 2. Loading the brief

- Same Supabase query as the existing GET `[briefId]` route:  
  `case_briefs` with `.eq('id', briefId).eq('case_id', caseId).eq('clerk_user_id', userId).maybeSingle()`.
- Use `brief.brief_json` (already validated when the brief was saved). Optionally use `brief.version_number` and case title for the PDF header/filename.
- Do **not** call the generate endpoint; only read stored data.

---

## 3. brief_json shape (for PDF content)

Types live in `lib/ai/brief-schema.ts`. Structure:

- **executive_overview** (string)
- **evidence_index** — `Record<string, { type?, description?, url? }>` (optional to include in PDF or as appendix)
- **working_timeline** — `Array<{ time_window, event, confidence, basis, source_ids }>`
- **key_entities** — `Array<{ name, type, source_refs }>`
- **contradictions_tensions** — `Array<{ issue, details, source_refs }>`
- **verification_tasks** — `Array<{ task, priority, suggested_queries }>`

Suggested PDF section order (matches in-app view): Executive Overview → Working Timeline → Key Entities → Contradictions / Tensions → Verification Tasks. Optionally Evidence Index at the end.

---

## 4. UI expectation (already implemented)

- **Request:** GET `/api/cases/[caseId]/briefs/[briefId]/pdf` with `credentials: 'include'` (cookies).
- **Success:** Response is a blob; UI creates object URL and triggers download with filename `brief-v${version_number}.pdf`.
- **404:** UI shows “PDF not available yet”; any other error shows “Failed to download PDF”.

So the route must return a **binary PDF body** with status 200 and correct headers so the browser treats it as a download.

---

## 5. Response format (Next.js API route)

- **Status:** 200 on success.
- **Headers:**
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="brief-vN.pdf"` (use actual `version_number`; avoid special characters in filename).
- **Body:** Raw PDF bytes (e.g. `Buffer` or `Uint8Array`). In Next.js 14 App Router you can return `new NextResponse(pdfBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="brief-v1.pdf"' } })`.

---

## 6. PDF generation (no library in repo yet)

- **Current deps:** No `jspdf`, `pdf-lib`, `@react-pdf/renderer`, or `puppeteer` in `package.json`. You will need to add a server-side PDF library.
- **Suggested options:**
  - **jspdf** — Good for text + simple layout; works in Node/Next API routes. Can add headings, paragraphs, lists.
  - **pdf-lib** — Create/update PDFs; no HTML/CSS, more low-level.
  - **@react-pdf/renderer** — React components → PDF; can be used from a server route with a dedicated render (research “react-pdf server side” for your setup).
- **Recommendation:** Start with **jspdf** (or **jspdf + jspdf-autotable** for tables) for a “polished” text-based brief: title, sections, headings, body text, bullet lists. Use the same section order as the in-app view for consistency.

---

## 7. Optional: case title in PDF

- To show case title on the first page, fetch the case (you already need it for auth). Use `caseRow.title` (or similar) from the same `cases` row used for the 403 check. If you don’t have it, query `cases` with `.select('title')` along with `id, user_id`.

---

## 8. Guardrails (do not change)

- Do not modify archive/CDX/Wayback, saved_links, query generation/grouping, Stripe/webhooks, or auth flows.
- Only add the new PDF route and any helper used to build the PDF (e.g. a `lib/pdf/brief-to-pdf.ts` that takes `brief_json` + optional case title + version and returns a buffer).

---

## 9. File layout

- **New:** `app/api/cases/[caseId]/briefs/[briefId]/pdf/route.ts` — GET handler: auth → load case + brief (same as existing [briefId] route) → build PDF from `brief_json` → return PDF response.
- **Optional:** `lib/pdf/brief-to-pdf.ts` (or similar) — pure function: `(briefJson, options?: { caseTitle?, versionNumber? }) => Buffer` to keep the route thin.

---

## 10. One-line summary for your prompt

Phase 5.4: Add GET `/api/cases/[caseId]/briefs/[briefId]/pdf` that reuses the existing [briefId] auth/ownership and DB load, reads stored `brief_json`, generates a polished PDF (add a server-side PDF lib e.g. jspdf), and returns it with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="brief-vN.pdf"`; no changes to archive/saved/queries/Stripe/auth.
