# Case Code Cheat Sheet

Reference for the case/brief/tasks/entities code we built: how to populate, how it works, and rules.

---

## 1. Data model (tables)

| Table | Purpose |
|-------|--------|
| **cases** | One row per case. `title`, `tags` (JSON), `objective` (optional), `user_id`. |
| **queries** | Queries belong to a case via `case_id`. `raw_input`, `normalized_input`, `input_type`, `status`. |
| **case_briefs** | One row per brief version. `case_id`, `clerk_user_id`, `version_number`, `brief_json`, `evidence_counts`, `user_note`. |
| **case_entities** | Extracted entities per case. `case_id`, `user_id`, `name`, `entity_type`, `mention_count`. |
| **entity_mentions** | Where each entity was found. `case_id`, `user_id`, `entity_id`, `evidence_kind`, `evidence_id`, `query_id`, `context_snippet`. |
| **case_tasks** | Tasks (manual or imported from brief). `case_id`, `user_id`, `title`, `detail`, `priority`, `status`, `source` ('manual' \| 'ai'). |
| **saved_links** | Can be scoped to case: `case_id`; also `query_id`, `source_tier` (primary/secondary). |
| **saved_link_notes** | Per-link notes for saved links (used in brief payload and brief viewer). |

---

## 2. How to populate

### Cases

| Action | API | Body / params |
|--------|-----|----------------|
| List | `GET /api/cases` | — |
| Create | `POST /api/cases` | `{ title, tags?, objective? }` |
| Update | `PATCH /api/cases/[caseId]` | `{ title?, objective? }` |
| Delete | `DELETE /api/cases?caseId=...` | query: `caseId` |

- All require auth. Ownership: `user_id` on case (or null for legacy).

### Queries

- Created/live elsewhere (e.g. search flow). They are **scoped by `case_id`**: each query has `case_id` so the case page can load `GET /api/queries?caseId=...`.

### Briefs

| Action | API | Body / params |
|--------|-----|----------------|
| **Generate** (AI) | `POST /api/cases/[caseId]/brief` | (none) |
| List | `GET /api/cases/[caseId]/briefs` | — |
| Get one | `GET /api/cases/[caseId]/briefs/[briefId]` | — |
| Update | `PATCH /api/cases/[caseId]/briefs/[briefId]` | `{ user_note?, brief_json? }` |
| PDF | `GET /api/cases/[caseId]/briefs/[briefId]/pdf` | — |

- **Generate** loads case, then:
  - Queries for case → results + notes per query, saved_links for case (with `source_tier`), saved_link_notes.
  - Builds payload: `queries`, `results_by_query`, `notes_by_query`, `saved_links` (with per-link `notes`), `counts`, `evidence_bundle_counts`, optional `case.objective`.
  - Sends to AI; validates with `validateBriefJson`; computes diff vs previous version, integrity_score, evidence_network, evidence_strength, coherence_alerts; optionally entity_summary_panel + evidence_summary_panel from DB.
  - Inserts into `case_briefs` with next `version_number`.

### Entities

| Action | API | Body / params |
|--------|-----|----------------|
| List | `GET /api/cases/[caseId]/entities` | — (top 20 by mention_count) |
| **Rebuild** | `POST /api/cases/[caseId]/entities/rebuild` | (none) |

- **Rebuild**: gathers text from results, notes, saved_links (title + snippet + `extracted_text`) for the case; runs `extractEntities()` (lib/entities/extract); deletes existing entity_mentions + case_entities for case/user; inserts new case_entities and entity_mentions.

### Tasks

| Action | API | Body / params |
|--------|-----|----------------|
| List | `GET /api/cases/[caseId]/tasks` | — |
| Create (manual) | `POST /api/cases/[caseId]/tasks` | `{ title, priority?, detail? }` — `priority`: high/medium/low, default medium; `status`: open; `source`: manual. |
| Update | `PATCH /api/cases/[caseId]/tasks/[taskId]` | `{ status?, priority?, title?, detail? }` — `status`: open \| in_progress \| done. |
| **Import from brief** | `POST /api/cases/[caseId]/tasks/import-from-brief` | `{ briefId? }` — if omitted, uses latest brief. |

- **Import**: reads brief’s `verification_tasks` and `critical_gaps`; normalizes task title; dedupes by normalized title vs existing case_tasks; inserts new rows with `source: 'ai'`. No AI call.

### Saved link – extract key facts

| Action | API | Body / params |
|--------|-----|----------------|
| Extract | `POST /api/cases/[caseId]/saved-links/[savedLinkId]/extract` | (none) |

- Fetches URL (with retries/backoff); if 429/503 can fall back to archive.org snapshot. Extracts plain text; heuristic key facts; updates `saved_links` (e.g. `extracted_text`). No OpenAI. Uses `dynamic = 'force-dynamic'` and archive fetch with `cache: 'no-store'` + User-Agent (per wayback rules).

---

## 3. How it works (flows)

### Case page (`app/app/cases/[caseId]/page.tsx`)

1. Loads cases list, current case, queries for case, entities, tasks.
2. Sidebar: `SidebarCases` (cases list, create, delete, select case).
3. Search: `SearchBar` → creates/runs queries for this `caseId`.
4. Query list: `QueryList` (timeline of queries); selected query drives Results.
5. Results: `ResultsTabs` (Results / Saved / Notes, etc.) for selected query and case.
6. Briefs: `CaseBriefs` (list briefs, generate, view, compare, PDF, user_note, verified toggles, Intel Dashboard, import tasks).
7. Edit case: dialog to PATCH case title and objective.
8. Entities: list from GET entities; “Rebuild entities” calls rebuild; sheet to view mentions per entity (GET entity mentions).
9. Tasks: list from GET tasks; filter open/done; add manual task; PATCH status/priority; “Import from brief” calls import-from-brief then refetch.

### Timeline page (`app/app/cases/[caseId]/timeline/page.tsx`)

- Lists queries for the case in time order (from `GET /api/queries?caseId=...`); links to each query’s context (e.g. case page with that query selected).

### Brief generation payload (what the AI sees)

- **case**: title, tags, optional objective.
- **queries**: id, raw_input, normalized_input, input_type, status, created_at.
- **results_by_query**: per-query results (source, title, url, snippet, etc.).
- **notes_by_query**: per-query notes (content truncated).
- **saved_links**: url, title, snippet, source_tier, per-link **notes** (from saved_link_notes).
- **counts**: queries, results, notes, saved_links, wayback_results.
- **evidence_bundle_counts**: from `buildCaseEvidenceBundle` (result/saved_link/note counts).

Evidence index IDs in the brief: `q1`, `q2`, … (queries); `s1`, `s2`, … (saved_links); `n1`, `n2`, … (notes); `r1`, `r2`, … (results). All timeline/entity/contradiction refs must use these IDs.

### Brief JSON shape (required / optional)

- **Required**: `executive_overview`, `evidence_index`, `working_timeline`, `key_entities`, `contradictions_tensions`, `verification_tasks`.
- **Optional**: `evidence_strength`, `threads`, `hypotheses`, `critical_gaps`, `collapse_tests`, `incentive_matrix`.
- **Contradictions**: use structured conflict format (issue, issue_type, statement_a, statement_a_refs, statement_b, statement_b_refs, why_it_matters, resolution_tasks); no legacy-only format.
- **Computed after validation**: `changes_since_last_version`, `source_credibility_summary`, `integrity_score`, `evidence_network`, evidence_strength counts, `coherence_alerts`; optionally `entity_summary_panel`, `evidence_summary_panel`.

### Intel Dashboard (`components/intel-dashboard.tsx`)

- Consumes `briefJson`, `caseId`, `entities`, `tasks`, and callbacks.
- Shows: integrity score, source credibility, coherence alerts; top entities (from props); evidence index; verification tasks; optional “Import tasks” and open-entity-mentions.

### Case briefs component (`components/case-briefs.tsx`)

- Props: `caseId`, `caseObjective?`, `onTasksImported?`, `entities?`, `onOpenEntityMentions?`, `tasks?`, `fetchTasks?`.
- Lists briefs; “Generate” → POST brief; view → GET brief + saved_links_with_notes; PDF link; user_note and brief_json PATCH; version diff; Intel Dashboard; import tasks from brief.

---

## 4. Key files

| Area | API routes | UI / lib |
|------|------------|----------|
| Cases | `app/api/cases/route.ts`, `app/api/cases/[caseId]/route.ts` | `app/app/cases/[caseId]/page.tsx`, `components/sidebar-cases.tsx` |
| Briefs | `app/api/cases/[caseId]/brief/route.ts`, `.../briefs/route.ts`, `.../briefs/[briefId]/route.ts`, `.../briefs/[briefId]/pdf/route.ts` | `components/case-briefs.tsx`, `lib/ai/brief-schema.ts`, `lib/pdf/brief-to-pdf.ts` |
| Entities | `app/api/cases/[caseId]/entities/route.ts`, `.../entities/rebuild/route.ts`, `.../entities/[entityId]/mentions/route.ts` | Case page (entities sheet), `lib/entities/extract.ts` |
| Tasks | `app/api/cases/[caseId]/tasks/route.ts`, `.../tasks/[taskId]/route.ts`, `.../tasks/import-from-brief/route.ts` | Case page, CaseBriefs (import), IntelDashboard |
| Saved link extract | `app/api/cases/[caseId]/saved-links/[savedLinkId]/extract/route.ts` | (triggered from UI that has case + saved link) |
| Brief diff / integrity / coherence | — | `lib/brief-diff.ts`, `lib/integrity-score.ts`, `lib/evidence-network.ts`, `lib/evidence-strength.ts`, `lib/coherence-alerts.ts` |

---

## 5. Rules (case code)

1. **Auth and ownership**  
   All case APIs check Clerk auth; case/brief/entity/task access is scoped by `user_id` or `clerk_user_id` and `case_id`. Do not return data for another user’s case.

2. **Brief evidence refs**  
   Every `source_ids` / `source_refs` / `statement_a_refs` / `statement_b_refs` / etc. in the brief must reference keys that exist in `evidence_index` (e.g. q1, s1, n1, r1). Validation enforces this.

3. **Saved links and case**  
   When saving from the case/archive context, send `query_id` and `case_id` so the saved state is scoped correctly (see main project cheat sheet for saved-tab rules).

4. **Extract route and archive**  
   The saved-link extract route calls archive.org on fallback; it must use `cache: 'no-store'` and a User-Agent for those fetches, and keep `export const dynamic = 'force-dynamic'` (same as wayback rules).

5. **Entities rebuild**  
   Rebuild reads from results, notes, and saved_links (with `extracted_text` when present). Deleting then re-inserting entities/mentions is by design; do not leave orphan mentions.

6. **Tasks import**  
   Import is deterministic: no AI. Dedupe by normalized title. New tasks get `source: 'ai'`; manual tasks keep `source: 'manual'`.

7. **Case objective**  
   Optional on case; when set, it is included in the brief payload and in the system prompt so the AI orients the brief toward that objective.

---

## 6. Migrations / scripts

- **Cases / case_id on queries**: use existing migrations and scripts (e.g. `db:migrate:case-id`).
- **Case tasks**: `npm run db:migrate:case-tasks` (see `scripts/run-case-tasks-migration.js`).
- **Case entities / mentions**: migration `supabase/migrations/20260220130000_create_case_entities_and_mentions.sql`.
- **Case objective**: migration `supabase/migrations/20260223120000_add_case_objective.sql`.
- **Saved links**: `source_tier`, `extraction` / `extracted_text` have their own migrations.

---

## 7. AI reference: brief structure

When the AI generates or organizes the forensic brief, it should use **how we actually structured each section**. That is documented in **`docs/AI-BRIEF-STRUCTURE-CHEAT-SHEET.md`**: exact field names, types, allowed values, and how each part works (evidence_index IDs, evidence_strength thematic lines and supporting_refs, incentive_matrix conditional language, contradictions structured format, etc.). Include that doc (or a condensed version) in the brief/organizer system prompt so the AI outputs valid JSON and checks every box.

---

*This doc is the cheat sheet for the case code only. For notes, attachments, wayback, mobile, saved-tab scoping, and refactor rules, see `docs/CHEAT-SHEET.md`.*
