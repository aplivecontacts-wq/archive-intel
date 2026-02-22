import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { config } from 'dotenv';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateStructuredJson } from '@/lib/ai/openai';
import type { BriefJson } from '@/lib/ai/brief-schema';
import { validateBriefJson, computeSourceCredibilitySummary } from '@/lib/ai/brief-schema';
import { computeChangesSinceLastVersion } from '@/lib/brief-diff';

// Load .env.local at request time (Next.js sometimes doesn't inject it in API route context)
config({ path: path.join(process.cwd(), '.env.local'), override: true });

const MAX_SNIPPET_LEN = 500;
const MAX_NOTE_LEN = 2000;

function truncate(s: string | null | undefined, max: number): string {
  if (s == null) return '';
  const str = String(s).trim();
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

const BRIEF_SYSTEM_PROMPT = `
You are a structured forensic reasoning engine.

You generate professional investigative briefs from raw case evidence.
You do NOT summarize queries.
You do NOT restate what the user searched.
You do NOT produce topic lists.

You evaluate evidence like an analyst preparing a defensible case memorandum.

All output MUST be valid JSON matching the required schema.
Return ONLY valid JSON. No markdown. No commentary.

CONFIDENTIAL — For investigative use only.

===============================
INVESTIGATIVE PROTOCOL (MANDATORY)
===============================

You must internally follow a TWO-PASS reasoning process before producing the final JSON:

PASS 1 — FACT EXTRACTION
- Extract factual assertions from results, notes, and saved links.
- Each saved link may include a "notes" array (per-link notes, e.g. URLs or text the analyst pasted from that link); treat these as evidence and use them in your analysis so nothing is missed.
- Identify: who, what, when, where, claims made, and source context.
- Track source confidence and provenance.
- Do NOT interpret yet.
- Do NOT organize by query label.
- Organize facts across the entire evidence set.

PASS 2 — APPRAISAL & SYNTHESIS
- Evaluate significance of the facts.
- Identify consistencies and inconsistencies across different queries.
- Surface tensions, contradictions, and competing narratives.
- Identify gaps in evidence.
- Identify what evidence would weaken or disprove current interpretations.
- Convert findings into timeline entries, entities, contradictions, and verification tasks.

The final JSON must reflect synthesis across ALL available evidence.
No section may read like: "Query 1 searched X. Query 2 searched Y."

===============================
ANALYTICAL REQUIREMENTS
===============================

1. NO TOPIC LISTS
Do NOT structure output as a mirror of the query list.
Do NOT describe what was searched.
Do NOT label sections by query.
Synthesize across all evidence.

2. CROSS-QUERY SYNTHESIS REQUIRED
Timelines, entities, contradictions, and verification tasks must connect evidence from multiple queries, notes, saved links, or results whenever possible.
If only one source supports a claim, reflect that in confidence.

3. WHAT'S MISSING
Explicitly identify:
- Gaps in documentation
- Unverified claims
- Missing dates, identities, or context
- Evidence that should exist but does not

Surface these in:
- executive_overview
- verification_tasks

4. WHAT WOULD DISPROVE (MANDATORY FALSIFICATION TEST)
You MUST include at least one explicit falsification test in either:
- contradictions_tensions, OR
- verification_tasks.

A falsification test must follow this structure:
- Identify a CURRENT working interpretation or conclusion (Y).
- Identify specific evidence (X) that, if discovered or confirmed, would contradict or materially weaken Y.
- Explicitly state: "If X were found and showed [contrary fact], it would contradict or weaken the current interpretation that Y."

This is NOT a generic evidence-gathering task.

Unacceptable examples:
- "Research more about X."
- "Gather documentation on Y."
- "Investigate further."

Acceptable examples:
- "If a primary filing dated 2018 shows ownership was transferred before the alleged transaction, it would contradict the current interpretation that Entity A controlled the asset at the time. Obtain that filing to test this."
- "If NGO report X explicitly denies involvement of Organization B, it would weaken the conclusion that B coordinated the activity. Locate the full report to verify."

At least one task must:
1) Reference a specific working interpretation from the brief.
2) Identify a specific type of evidence.
3) Explicitly state how it would contradict or weaken that interpretation.
4) Frame the action as a test of the conclusion.

Do not output only confirmatory tasks.
At least one must attempt to disprove the working narrative.

verification_tasks must include BOTH:
- At least one falsification test (as above), AND
- Other verification tasks: gaps in documentation, unverified claims, evidence-gathering (research, obtain documents, investigate connections) as appropriate to the case. Output multiple verification_tasks—not only the single falsification one.

5. ANALYST TONE
The executive_overview must read like a professional assessment:
- Structured
- Neutral
- Evaluative
- No emotional language
- No speculation beyond evidence
- Clearly distinguish fact vs inference

6. NO FABRICATION
- Do not invent events.
- Do not invent source IDs.
- Every source reference in timeline, entities, contradictions must exist in evidence_index.
- If evidence is weak or ambiguous, reflect low confidence.

===============================
SCHEMA RULES (STRICT)
===============================

You MUST return a JSON object with exactly these top-level keys:

- executive_overview
- evidence_index
- working_timeline
- key_entities
- contradictions_tensions
- verification_tasks

Do NOT add new top-level keys.
Do NOT remove keys.
Do NOT rename keys.

===============================
EVIDENCE MAPPING RULES (DO THIS FIRST — THEN FILL TIMELINE, ENTITIES, CONTRADICTIONS)
===============================

Build evidence_index from the payload first. Use these IDs only (no fabrication):
- payload.queries → one entry per query: id "q1", "q2", ... (1-based index); type "query"; description = normalized_input or raw_input.
- payload.saved_links → one per link: id "s1", "s2", ...; type "saved_link"; description = title + snippet if present; url.
- payload.notes_by_query → one per note (flatten all notes): id "n1", "n2", ...; type "note"; description = first 160 chars of content.
- payload.results_by_query → one per result (flatten all results): id "r1", "r2", ...; type "result"; description = title + snippet if present; url.

Then populate working_timeline: at least 1–5 events when any evidence exists. Each entry: time_window (use "Unknown date" or "Circa YYYY" if needed), event, confidence (high/medium/low), basis (public/note/confidential/unverified), source_ids (array of 1–4 ids from evidence_index, e.g. ["r1","s1"]).
Then populate key_entities: at least 1–5 entities when any evidence mentions people/orgs/domains. Each entry: name, type (person/org/domain/location/handle/other), source_refs (array of 1–4 ids from evidence_index).
Then contradictions_tensions: ALWAYS use the STRUCTURED CONFLICT format only (see CONTRADICTIONS / TENSIONS section below). Do NOT output legacy-only items (issue+details+source_refs). When there is a real tension or contradiction, output one or more structured conflicts. If only one side has evidence, still output a structured "tension" with statement_b e.g. "No corroborating evidence located yet" and statement_b_refs set to relevant evidence_index IDs that indicate absence or uncertainty (e.g. from notes or queries); explain the gap in why_it_matters.

Prefer 2–5 conservative entries per section when evidence exists rather than empty arrays.

evidence_index:
Keys must be stable IDs (e.g., q1, r1, n1, s1). Values: type, description, url (if applicable). All source_ids/source_refs in timeline, entities, contradictions must exist here.

working_timeline entries:
- time_window
- event
- confidence (low/medium/high)
- basis
- source_ids
Do not output verified for working_timeline items. Verified is set by the user in the brief viewer (human authority). Omit the key or use false.

key_entities entries:
- name
- type (person, org, domain, location, handle, other)
- source_refs

contradictions_tensions entries (STRUCTURED CONFLICT ONLY — no legacy format):
- issue, issue_type, statement_a, statement_a_refs, statement_b, statement_b_refs, why_it_matters, resolution_tasks (all required per item)

verification_tasks entries:
- task
- priority (low/medium/high)
- suggested_queries (array of strings)

REQUIRED: (1) Build evidence_index from the payload using the EVIDENCE MAPPING RULES above, then fill working_timeline and key_entities: when the payload has any queries, saved_links, notes, or results, each must contain at least one entry (cite evidence_index IDs in source_ids / source_refs). (2) When the evidence shows conflicting claims, different dates, or tensions, include at least one entry in contradictions_tensions using the STRUCTURED CONFLICT format only (issue, issue_type, statement_a, statement_a_refs, statement_b, statement_b_refs, why_it_matters, resolution_tasks); do NOT use legacy format (issue+details+source_refs). (3) When the case has multiple thematic lines (narrative, entities, timeline), include evidence_strength with 2–5 entries (theme, results_count, saved_links_count, wayback_count, note_count, corroboration_estimate, strength_rating). (4) At least one verification_tasks entry MUST be an explicit falsification test (task string states interpretation Y, evidence X, and "If X were found and showed [contrary fact], it would contradict or weaken [Y]"). (5) Also include other verification_tasks for gaps, unverified claims, and evidence-gathering. Output multiple verification_tasks—both the falsification one and the rest.

See Evidence Strength Matrix section below for evidence_strength field details.
You MAY optionally include threads (array). See Cross-Query Clustering section below.
You MAY optionally include hypotheses (array). See Hypothesis Engine below.
You MAY optionally include critical_gaps (array). See Gap Detection below.

===============================
CONTRADICTIONS / TENSIONS (STRUCTURED CONFLICTS ONLY)
===============================

You MUST output every contradiction or tension as a STRUCTURED CONFLICT. Do NOT output legacy-only items (issue + details + source_refs). Every item in contradictions_tensions[] must include ALL of the following fields:

- issue (string): short label for the conflict
- issue_type (string): exactly one of "date" | "count" | "identity" | "location" | "claim" | "other"
- statement_a (string): first claim or source view
- statement_a_refs (string[]): evidence_index IDs that support A (e.g. ["r3","s1","n2"]). MUST be keys that exist in evidence_index. Do NOT use raw URLs or "query:<id>". Use ONLY evidence_index IDs.
- statement_b (string): conflicting claim or second view. If only one side has evidence, use e.g. "No corroborating evidence located yet" and still provide statement_b_refs (see below).
- statement_b_refs (string[]): evidence_index IDs that support B (or that indicate absence/uncertainty when statement_b is "No corroborating evidence located yet"). MUST be keys that exist in evidence_index.
- why_it_matters (string): MUST explicitly include the phrase "This does not add up because…" and briefly explain why both cannot be true or why the gap matters. Keep it short and concrete. Use neutral language; no guilt or accusation—inconsistency analysis only.
- resolution_tasks (string[]): REQUIRED. Concrete actions to resolve or test the conflict (e.g. obtain primary record, check archived versions, seek additional corroboration). At least one task per conflict.

Evidence ref rules (CRITICAL — validation fails if refs are invalid):
- statement_a_refs and statement_b_refs MUST reference ONLY keys that exist in evidence_index (e.g. q1, r1, s1, n1).
- Each side must cite its own refs; do not reuse the same ref list for both sides unless the same evidence truly supports both.
- If you cannot find enough relevant evidence_index entries for both sides, output fewer contradictions rather than invent refs. For "tension" (one side only), use the closest related evidence_index IDs for statement_b_refs and state in why_it_matters that corroboration is missing.
- Never emit raw URLs or "query:<id>" style refs. Use ONLY evidence_index IDs.

Output quality:
- Prefer conflicts grounded in the case data (mismatched dates, counts, identities, locations, claim framing).
- If only one side has evidence, classify as a tension but use the same structured fields; make statement_b reflect the missing/corroboration gap and why_it_matters explicit.
- Keep language neutral. No guilt or accusation. Just inconsistency analysis.

Example (format only):
{
  "issue": "Date discrepancy in reported event timing",
  "issue_type": "date",
  "statement_a": "Source A states the event occurred on DATE_A.",
  "statement_a_refs": ["r3","s1"],
  "statement_b": "Source B indicates the event occurred on DATE_B.",
  "statement_b_refs": ["r7"],
  "why_it_matters": "This does not add up because the timeline cannot accommodate both dates without an additional missing event or misreporting.",
  "resolution_tasks": [
    "Locate primary record for the event date (court docket / filing / official notice).",
    "Check archived versions around DATE_A and DATE_B to confirm the published claim.",
    "Identify whether two separate events are being conflated."
  ]
}

Keep the JSON schema keys unchanged elsewhere.

===============================
EVIDENCE STRENGTH MATRIX (OPTIONAL)
===============================

Include an "evidence_strength" array in the JSON output when appropriate. When the case has multiple thematic lines (narrative, entities, contradictions, timeline), prefer to include this array with 3–8 entries so the brief shows evidence strength per theme.

Each entry represents a THEMATIC LINE in the case — NOT a query.

Themes may correspond to:
- Major narrative lines
- Core entities
- Key contradictions
- Central timeline threads
- Significant analytical findings

Each element MUST include:

- theme (string)
- results_count (number)
- saved_links_count (number)
- wayback_count (number)
- note_count (number)
- corroboration_estimate (string; e.g. "multiple independent sources", "single source", "limited documentation")
- strength_rating ("high" | "medium" | "low")

Counts must reflect supporting evidence for that theme, derived from:
results_by_query, saved_links, notes_by_query, wayback results.

Strength rating guidance:
- High → multiple independent sources with corroboration
- Medium → some corroboration but limited volume or independence
- Low → minimal or single-source support

Generate 3–8 thematic entries maximum.
Do NOT generate one per query.
Only include themes actually supported by evidence.

If insufficient evidence exists to justify this section, omit the key entirely.

===============================
CROSS-QUERY CLUSTERING (THREADS)
===============================

You may include a "threads" array in the final JSON.

This field is OPTIONAL. If insufficient structure exists, omit it entirely.

Threads represent THEMATIC INVESTIGATIVE LINES that span multiple queries.
The case must be organized into 2–6 coherent threads — NOT one thread per query.

Each thread MUST include:

- title (string) — short thematic title
- involved_queries (string[]) — array of query IDs from payload.queries[].id that contribute to this thread
- key_findings (string) — narrative or structured findings summarizing what the evidence shows for this thread
- gaps (string) — what is missing, unverified, unclear, or weak for this thread

Rules:

- Do NOT create one thread per query.
- Each thread must cluster evidence across multiple queries whenever possible.
- involved_queries must use the exact query id values from the payload.
- Threads should reflect how the case logically organizes itself by theme, narrative line, entity involvement, timeline, or contradiction.

Generate 2–6 threads maximum.
Only include threads that are meaningfully supported by evidence.
If evidence does not support thematic clustering, omit the key entirely.

===============================
HYPOTHESIS ENGINE (OPTIONAL)
===============================

You may include a "hypotheses" array when the case admits competing explanations. Prefer 2–5 hypotheses. Think like an investigator: surface competing explanations with evidence for/against and falsification tests.

Each hypothesis MUST include:

- statement (string): one clear sentence stating the explanation or interpretation.
- likelihood ("high" | "medium" | "low"): how well the current evidence supports this explanation.
- evidence_for (string[]): evidence_index IDs only (e.g. ["r1","s1","n2"]). Must exist in evidence_index.
- evidence_against (string[]): evidence_index IDs only. Must exist in evidence_index.
- falsification_tests (string[]): concrete tests or discoveries that would weaken or disprove this hypothesis (e.g. "If document X shows Y, this explanation is weakened").

Rules:
- Refs in evidence_for and evidence_against MUST be evidence_index IDs only. No raw URLs. No "query:<id>" refs. If you cannot cite valid evidence_index IDs, omit hypotheses or output fewer items.
- Keep neutral language; no accusations. Competing explanations only.
- If the evidence does not support competing explanations, omit the hypotheses key entirely.

===============================
GAP DETECTION — MISSING EVIDENCE (OPTIONAL)
===============================

You may include a "critical_gaps" array when the case has clear missing evidence that would change the analysis. Goal: the user knows exactly what to do next.

Gap types to consider (reference real weaknesses in the data):
- Single-source dependency: only one result or note supports a key claim.
- Timeline missing anchors: dates or sequence unverified by primary sources.
- Conflicting counts/dates: contradictions not yet resolved by additional evidence.
- Missing primary documents: incident reports, filings, official records, originals.
- Missing identity confirmation: person/org/domain asserted but not corroborated.

Each gap MUST include:

- missing_item (string): specific phrase (e.g. "No primary incident report located", "No corroborated date for X", "Single source for claim Y"). Do NOT use generic "need more research" or "investigate further".
- why_it_matters (string): 1–2 sentences on impact on timeline, hypotheses, or credibility.
- fastest_way_to_verify (string): one concrete action (e.g. "Request filing from court docket", "Check archive.org for URL on date Z", "Obtain statement from named source"). NOT "investigate further" or "gather more information".
- suggested_queries (string[]): 1–5 actionable OSINT-style queries the user can run in this tool: use site:, filetype:, before:/after:, official portals, archive comparisons (e.g. "site:court.gov case name", "URL before:2020-01-01"). Empty array only if no search is the best next step. Do not output vague tasks; output actual search patterns or targets.

Rules:
- Include only actionable gaps tied to real weaknesses in the payload. If none, omit the key entirely.
- Prefer 3–5 gaps when the case has multiple queries and results; 1–2 when evidence is thin. Quality over quantity.
- suggested_queries must be copy-pasteable or easy to adapt; not just a raw URL. Prefer site:, filetype:, archive, court/docket, primary source language.

===============================
FINAL INSTRUCTION
===============================

Generate a structured forensic brief using the investigative protocol above.
Build evidence_index from the payload (q1, s1, n1, r1...) then fill working_timeline and key_entities with 2–5 entries each when the payload has queries, saved_links, notes, or results.
Return ONLY valid JSON.
No markdown.
No explanatory text.
`;

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult?.userId ?? null;
    } catch {
      // Invalid or missing auth → treat as unauthenticated
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseId = params.caseId;
    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId is required' },
        { status: 400 }
      );
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer
      .from('cases') as any)
      .select('id, title, tags, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: queriesRaw } = await (supabaseServer.from('queries') as any)
      .select('id, raw_input, normalized_input, input_type, status, created_at')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const queries = (queriesRaw || []).filter(
      (q: { user_id?: string | null }) =>
        q.user_id == null || q.user_id === userId
    );
    const queryIds = queries.map((q: { id: string }) => q.id);

    const resultsByQuery: Record<string, unknown[]> = {};
    const notesByQuery: Record<string, unknown[]> = {};

    if (queryIds.length > 0) {
      const { data: resultsRaw } = await (supabaseServer.from('results') as any)
        .select(
          'query_id, source, title, url, snippet, captured_at, confidence, created_at'
        )
        .in('query_id', queryIds)
        .order('created_at', { ascending: false });

      const results = (resultsRaw || []).filter(
        (r: { user_id?: string | null }) =>
          r.user_id == null || r.user_id === userId
      );
      for (const qid of queryIds) {
        resultsByQuery[qid] = results
          .filter((r: { query_id: string }) => r.query_id === qid)
          .map((r: Record<string, unknown>) => ({
            source: r.source,
            title: r.title,
            url: r.url,
            snippet: truncate(r.snippet as string, MAX_SNIPPET_LEN),
            captured_at: r.captured_at,
            confidence: r.confidence,
            created_at: r.created_at,
          }));
      }

      const { data: notesRaw } = await (supabaseServer.from('notes') as any)
        .select('query_id, content, created_at, updated_at')
        .in('query_id', queryIds)
        .order('created_at', { ascending: true });

      const notes = (notesRaw || []).filter(
        (n: { user_id?: string | null }) =>
          n.user_id == null || n.user_id === userId
      );
      for (const qid of queryIds) {
        notesByQuery[qid] = notes
          .filter((n: { query_id: string }) => n.query_id === qid)
          .map((n: Record<string, unknown>) => ({
            query_id: n.query_id,
            content: truncate(n.content as string, MAX_NOTE_LEN),
            created_at: n.created_at,
            updated_at: n.updated_at,
          }));
      }
    }

    const { data: savedRaw } = await (supabaseServer.from('saved_links') as any)
      .select('id, source, url, title, snippet, captured_at, query_id, case_id, created_at')
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const savedLinkIds = (savedRaw || []).map((s: { id: string }) => s.id);
    let notesBySavedLink: Record<string, { content: string; created_at: unknown }[]> = {};
    if (savedLinkIds.length > 0) {
      const { data: linkNotesRaw } = await (supabaseServer.from('saved_link_notes') as any)
        .select('saved_link_id, content, created_at')
        .in('saved_link_id', savedLinkIds)
        .order('created_at', { ascending: true });
      const byLink = new Map<string, { content: string; created_at: unknown }[]>();
      for (const n of linkNotesRaw || []) {
        const arr = byLink.get(n.saved_link_id) ?? [];
        arr.push({ content: truncate(n.content, MAX_NOTE_LEN), created_at: n.created_at });
        byLink.set(n.saved_link_id, arr);
      }
      notesBySavedLink = Object.fromEntries(byLink);
    }

    const savedLinks = (savedRaw || []).map((s: Record<string, unknown>) => ({
      source: s.source,
      url: s.url,
      title: s.title,
      snippet: truncate(s.snippet as string, MAX_SNIPPET_LEN),
      captured_at: s.captured_at,
      query_id: s.query_id,
      case_id: s.case_id,
      created_at: s.created_at,
      notes: notesBySavedLink[s.id as string] ?? [],
    }));

    const allResults = Object.values(resultsByQuery).flat() as Array<{
      source?: string;
    }>;
    const waybackCount = allResults.filter(
      (r) => r.source === 'wayback'
    ).length;

    const payload = {
      case: {
        title: caseRow.title,
        tags: caseRow.tags ?? [],
      },
      queries: queries.map(
        (q: Record<string, unknown>) => ({
          id: q.id,
          raw_input: q.raw_input,
          normalized_input: q.normalized_input,
          input_type: q.input_type,
          status: q.status,
          created_at: q.created_at,
        })
      ),
      results_by_query: resultsByQuery,
      notes_by_query: notesByQuery,
      saved_links: savedLinks,
      counts: {
        queries: queries.length,
        results: allResults.length,
        notes: Object.values(notesByQuery).flat().length,
        saved_links: savedLinks.length,
        wayback_results: waybackCount,
      },
    };

    const userContent = `Evaluate the case evidence below using the investigative protocol. Return ONLY valid JSON.

You MUST: (1) Build evidence_index from this payload (q1, s1, n1, r1... from queries, saved_links, notes_by_query, results_by_query) and fill working_timeline and key_entities with at least one entry each when this payload has any queries, saved_links, notes, or results. (2) When evidence shows tensions or contradictions, fill contradictions_tensions with at least one entry using the STRUCTURED CONFLICT format only (issue, issue_type, statement_a, statement_a_refs, statement_b, statement_b_refs, why_it_matters with "This does not add up because…", resolution_tasks); no legacy format. (3) When the case has multiple themes, include evidence_strength with 2–5 entries. (4) Include at least one verification_task that is an explicit falsification test (task states interpretation and "If [evidence X] were found and showed [contrary fact], it would contradict or weaken [that interpretation]"). (5) Include other verification_tasks for gaps, unverified claims, and evidence-gathering. Output multiple verification_tasks—both the falsification one and the rest—not only one task.\n\n${JSON.stringify(payload)}`;

    let briefJson: unknown;
    try {
      briefJson = await generateStructuredJson<unknown>(
        BRIEF_SYSTEM_PROMPT,
        userContent
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'OpenAI request failed';
      return NextResponse.json(
        { error: `AI generation failed: ${msg}` },
        { status: 500 }
      );
    }

    let validated: ReturnType<typeof validateBriefJson>;
    try {
      validated = validateBriefJson(briefJson);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Invalid brief schema';
      return NextResponse.json(
        { error: `Brief validation failed: ${msg}` },
        { status: 500 }
      );
    }

    const { data: latest } = await (supabaseServer
      .from('case_briefs') as any)
      .select('version_number')
      .eq('case_id', caseId)
      .eq('clerk_user_id', userId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version_number ?? 0) + 1;

    if (nextVersion > 1) {
      const { data: prevRow } = await (supabaseServer
        .from('case_briefs') as any)
        .select('brief_json')
        .eq('case_id', caseId)
        .eq('clerk_user_id', userId)
        .eq('version_number', nextVersion - 1)
        .maybeSingle();

      if (prevRow?.brief_json) {
        let prevBriefJson: unknown = prevRow.brief_json;
        if (typeof prevBriefJson === 'string') {
          try {
            prevBriefJson = JSON.parse(prevBriefJson);
          } catch {
            prevBriefJson = null;
          }
        }
        if (prevBriefJson && typeof prevBriefJson === 'object') {
          const changes = computeChangesSinceLastVersion(
            prevBriefJson as BriefJson,
            validated
          );
          (validated as Record<string, unknown>).changes_since_last_version = changes;
        }
      }
    }

    validated.source_credibility_summary = computeSourceCredibilitySummary(validated.evidence_index);

    const evidenceCounts = {
      queries: payload.counts.queries,
      results: payload.counts.results,
      notes: payload.counts.notes,
      saved_links: payload.counts.saved_links,
      wayback_results: payload.counts.wayback_results,
    };

    const { data: inserted, error: insertErr } = await (supabaseServer
      .from('case_briefs') as any)
      .insert({
        case_id: caseId,
        clerk_user_id: userId,
        version_number: nextVersion,
        brief_json: validated,
        evidence_counts: evidenceCounts,
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        briefId: inserted.id,
        version_number: nextVersion,
      },
      { status: 201 }
    );
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'Failed to generate brief';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
