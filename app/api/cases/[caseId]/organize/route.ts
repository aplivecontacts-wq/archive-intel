/**
 * POST /api/cases/[caseId]/organize
 * Organizer: sees full evidence (queries, results, notes, saved links + notes + ai_*), returns structured
 * evidence_map, suggested_timeline, gaps, contradictions_high_level, next_steps. Records token usage.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { config } from 'dotenv';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateStructuredJson } from '@/lib/ai/openai';
import { recordTokenUsage } from '@/lib/usage';

config({ path: path.join(process.cwd(), '.env.local'), override: true });

const MAX_SNIPPET = 300;
const MAX_NOTE = 500;

function truncate(s: string | null | undefined, max: number): string {
  if (s == null) return '';
  const str = String(s).trim();
  return str.length <= max ? str : str.slice(0, max) + '...';
}

type OrganizeResult = {
  evidence_map?: string;
  suggested_timeline?: Array<{ label: string; order: number }>;
  gaps?: string[];
  contradictions_high_level?: string[];
  next_steps?: string[];
};

const ORGANIZER_SYSTEM = `You have the full evidence set for a case: case (title, objective), queries, results per query, notes per query, saved links with their notes and (when present) ai_summary and ai_key_facts from having opened and analyzed each link.
Your job is to organize and structure only. Output ONLY valid JSON with these optional keys (all can be empty arrays or missing if not applicable):
- evidence_map: string (short summary of which links/notes support which claims or themes)
- suggested_timeline: array of { label: string, order: number } (key events in order)
- gaps: array of strings (what is missing or weak)
- contradictions_high_level: array of strings (high-level contradictions or tensions)
- next_steps: array of strings (concrete recommended actions)

Use the product rules: evidence_index IDs are q1, s1, n1, r1; timeline and entities cite those; contradictions use structured format. Your output will be used to help the brief writer. Be concise. No prose outside the JSON.`;

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseId = params.caseId;
    if (!caseId) {
      return NextResponse.json({ error: 'caseId required' }, { status: 400 });
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer as any)
      .from('cases')
      .select('id, title, objective, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: queriesRaw } = await (supabaseServer.from('queries') as any)
      .select('id, raw_input, normalized_input, created_at')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const queries = (queriesRaw || []).filter(
      (q: { user_id?: string | null }) => q.user_id == null || q.user_id === userId
    );
    const queryIds = queries.map((q: { id: string }) => q.id);

    const resultsByQuery: Record<string, unknown[]> = {};
    const notesByQuery: Record<string, unknown[]> = {};

    if (queryIds.length > 0) {
      const { data: resultsRaw } = await (supabaseServer.from('results') as any)
        .select('query_id, source, title, url, snippet')
        .in('query_id', queryIds);
      const results = (resultsRaw || []).filter(
        (r: { user_id?: string | null }) => r.user_id == null || r.user_id === userId
      );
      for (const qid of queryIds) {
        resultsByQuery[qid] = results
          .filter((r: { query_id: string }) => r.query_id === qid)
          .map((r: Record<string, unknown>) => ({
            source: r.source,
            title: r.title,
            url: r.url,
            snippet: truncate(r.snippet as string, MAX_SNIPPET),
          }));
      }

      const { data: notesRaw } = await (supabaseServer.from('notes') as any)
        .select('query_id, content')
        .in('query_id', queryIds);
      const notes = (notesRaw || []).filter(
        (n: { user_id?: string | null }) => n.user_id == null || n.user_id === userId
      );
      for (const qid of queryIds) {
        notesByQuery[qid] = notes
          .filter((n: { query_id: string }) => n.query_id === qid)
          .map((n: Record<string, unknown>) => ({ content: truncate(n.content as string, MAX_NOTE) }));
      }
    }

    const { data: savedRaw } = await (supabaseServer.from('saved_links') as any)
      .select('id, url, title, snippet, source_tier, ai_summary, ai_key_facts')
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const savedLinkIds = (savedRaw || []).map((s: { id: string }) => s.id);
    let notesBySavedLink: Record<string, string[]> = {};
    if (savedLinkIds.length > 0) {
      const { data: linkNotesRaw } = await (supabaseServer.from('saved_link_notes') as any)
        .select('saved_link_id, content')
        .in('saved_link_id', savedLinkIds);
      const byLink = new Map<string, string[]>();
      for (const n of linkNotesRaw || []) {
        const arr = byLink.get(n.saved_link_id) ?? [];
        arr.push(truncate(n.content, MAX_NOTE));
        byLink.set(n.saved_link_id, arr);
      }
      notesBySavedLink = Object.fromEntries(byLink);
    }

    const savedLinks = (savedRaw || []).map((s: Record<string, unknown>) => ({
      url: s.url,
      title: s.title,
      snippet: truncate(s.snippet as string, MAX_SNIPPET),
      source_tier: s.source_tier ?? null,
      ai_summary: s.ai_summary ?? null,
      ai_key_facts: Array.isArray(s.ai_key_facts) ? s.ai_key_facts : null,
      notes: notesBySavedLink[s.id as string] ?? [],
    }));

    const payload = {
      case: {
        title: caseRow.title,
        objective: caseRow.objective != null && String(caseRow.objective).trim() !== '' ? String(caseRow.objective).trim() : null,
      },
      queries: queries.map((q: Record<string, unknown>) => ({
        id: q.id,
        raw_input: q.raw_input,
        normalized_input: q.normalized_input,
      })),
      results_by_query: resultsByQuery,
      notes_by_query: notesByQuery,
      saved_links: savedLinks,
    };

    const result = await generateStructuredJson<OrganizeResult>(ORGANIZER_SYSTEM, JSON.stringify(payload));
    if (result.usage && userId) {
      await recordTokenUsage(supabaseServer as any, userId, result.usage);
    }

    return NextResponse.json({
      ok: true,
      ...result.data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Organize failed';
    if (process.env.NODE_ENV === 'development') console.error('[organize]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
