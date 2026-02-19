import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { config } from 'dotenv';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateStructuredJson } from '@/lib/ai/openai';
import { validateBriefJson } from '@/lib/ai/brief-schema';

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

const BRIEF_SYSTEM_PROMPT = `You are a forensic brief analyst. Given case evidence (queries, results, notes, saved links), produce a structured forensic brief.

Output MUST be valid JSON matching this exact schema:
{
  "executive_overview": "string",
  "evidence_index": {
    "<id>": { "type": "query"|"result"|"note"|"saved_link", "description": "string", "url": "optional string" }
  },
  "working_timeline": [
    {
      "time_window": "string (date range or relative)",
      "event": "string",
      "confidence": "high"|"medium"|"low",
      "basis": "public"|"note"|"confidential"|"unverified",
      "source_ids": ["<id>", "<id>"]
    }
  ],
  "key_entities": [
    {
      "name": "string",
      "type": "person"|"org"|"domain"|"location"|"handle"|"other",
      "source_refs": ["..."]
    }
  ],
  "contradictions_tensions": [
    {
      "issue": "string",
      "details": "string",
      "source_refs": ["..."]
    }
  ],
  "verification_tasks": [
    {
      "task": "string",
      "priority": "high"|"medium"|"low",
      "suggested_queries": ["string"]
    }
  ]
}

Rules:
- evidence_index: Build an object whose keys are short stable IDs (e.g. "q1", "r1", "n1", "s1"). Each value describes one piece of evidence from the payload (type, description, url if applicable). Every source_id used in working_timeline MUST be a key in evidence_index.
- working_timeline[].source_ids: Array of evidence_index keys that support this timeline item. No fake IDs—every id must exist in evidence_index.
- Use neutral language. No accusations. No guilt.
- If note content begins with "CONFIDENTIAL:", use basis="confidential" for derived items.
- If no exact date, use range/relative wording and lower confidence.
- Return ONLY valid JSON, no markdown or extra text.`;

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
      .select('source, url, title, snippet, captured_at, query_id, case_id, created_at')
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const savedLinks = (savedRaw || []).map((s: Record<string, unknown>) => ({
      source: s.source,
      url: s.url,
      title: s.title,
      snippet: truncate(s.snippet as string, MAX_SNIPPET_LEN),
      captured_at: s.captured_at,
      query_id: s.query_id,
      case_id: s.case_id,
      created_at: s.created_at,
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

    const userContent = `Generate a forensic brief from this case evidence. Return ONLY valid JSON.\n\n${JSON.stringify(payload)}`;

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
