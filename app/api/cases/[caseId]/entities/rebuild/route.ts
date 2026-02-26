/**
 * Phase 3 (Cohesion): Rebuild entity graph for a case.
 * POST /api/cases/[caseId]/entities/rebuild
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { extractEntities } from '@/lib/entities/extract';

const SNIPPET_MAX = 200;

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

    const { data: caseRow, error: caseErr } = await (supabaseServer.from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const queryIds: string[] = [];
    const { data: queriesRaw } = await (supabaseServer.from('queries') as any)
      .select('id')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });
    const queries = (queriesRaw || []).filter(
      (q: { user_id?: string | null }) => q.user_id == null || q.user_id === userId
    );
    for (const q of queries) queryIds.push(q.id);

    type Chunk = { text: string; evidence_kind: string; evidence_id: string; query_id: string | null; context_snippet: string };
    const chunks: Chunk[] = [];

    if (queryIds.length > 0) {
      const { data: resultsRaw } = await (supabaseServer.from('results') as any)
        .select('id, query_id, snippet, title')
        .in('query_id', queryIds);
      const results = (resultsRaw || []).filter(
        (r: { user_id?: string | null }) => r.user_id == null || r.user_id === userId
      );
      for (const r of results) {
        const text = [r.title, r.snippet].filter(Boolean).join(' ');
        if (text.trim()) {
          chunks.push({
            text,
            evidence_kind: 'result',
            evidence_id: r.id,
            query_id: r.query_id ?? null,
            context_snippet: (r.snippet || r.title || '').slice(0, SNIPPET_MAX),
          });
        }
      }

      const { data: notesRaw } = await (supabaseServer.from('notes') as any)
        .select('id, query_id, content')
        .in('query_id', queryIds);
      const notes = (notesRaw || []).filter(
        (n: { user_id?: string | null }) => n.user_id == null || n.user_id === userId
      );
      for (const n of notes) {
        const text = (n.content || '').trim();
        if (text) {
          chunks.push({
            text,
            evidence_kind: 'note',
            evidence_id: n.id,
            query_id: n.query_id ?? null,
            context_snippet: text.slice(0, SNIPPET_MAX),
          });
        }
      }
    }

    const { data: savedRaw } = await (supabaseServer.from('saved_links') as any)
      .select('id, snippet, title, extracted_text, ai_summary, ai_key_facts')
      .eq('user_id', userId)
      .eq('case_id', caseId);
    for (const s of savedRaw || []) {
      const parts = [s.title, s.snippet];
      if (s.extracted_text) parts.push(s.extracted_text);
      if (s.ai_summary) parts.push(s.ai_summary);
      if (Array.isArray(s.ai_key_facts) && s.ai_key_facts.length > 0) {
        parts.push(s.ai_key_facts.join(' '));
      }
      const text = parts.filter(Boolean).join(' ');
      if (text.trim()) {
        chunks.push({
          text,
          evidence_kind: 'saved_link',
          evidence_id: s.id,
          query_id: null,
          context_snippet: (s.snippet || s.title || (s.extracted_text || '').slice(0, SNIPPET_MAX)).slice(0, SNIPPET_MAX),
        });
      }
    }

    const entityKey = (name: string, type: string) => `${name.toLowerCase()}\0${type}`;
    const entityCounts = new Map<string, number>();
    const mentionRows: { name: string; type: string; evidence_kind: string; evidence_id: string; query_id: string | null; context_snippet: string }[] = [];

    for (const ch of chunks) {
      const entities = extractEntities(ch.text);
      for (const e of entities) {
        const key = entityKey(e.name, e.type);
        entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1);
        mentionRows.push({
          name: e.name,
          type: e.type,
          evidence_kind: ch.evidence_kind,
          evidence_id: ch.evidence_id,
          query_id: ch.query_id,
          context_snippet: ch.context_snippet,
        });
      }
    }

    await (supabaseServer.from('entity_mentions') as any).delete().eq('case_id', caseId).eq('user_id', userId);
    await (supabaseServer.from('case_entities') as any).delete().eq('case_id', caseId).eq('user_id', userId);

    const entitiesToInsert = Array.from(entityCounts.entries()).map(([key, count]) => {
      const [name, entity_type] = key.split('\0');
      return { case_id: caseId, user_id: userId, name, entity_type, mention_count: count };
    });

    if (entitiesToInsert.length > 0) {
      const { data: insertedEntities, error: insErr } = await (supabaseServer.from('case_entities') as any)
        .insert(entitiesToInsert)
        .select('id, name, entity_type');
      if (insErr) {
        if (process.env.NODE_ENV === 'development') console.error('[entities/rebuild] insert entities', insErr);
        return NextResponse.json({ error: 'Failed to save entities' }, { status: 500 });
      }

      const nameTypeToId = new Map<string, string>();
      for (const row of insertedEntities || []) {
        nameTypeToId.set(entityKey(row.name, row.entity_type), row.id);
      }

      const mentionsToInsert = mentionRows
        .map((m) => {
          const id = nameTypeToId.get(entityKey(m.name, m.type));
          return id
            ? {
                case_id: caseId,
                user_id: userId,
                entity_id: id,
                evidence_kind: m.evidence_kind,
                evidence_id: m.evidence_id,
                query_id: m.query_id,
                context_snippet: m.context_snippet || null,
              }
            : null;
        })
        .filter(Boolean);

      if (mentionsToInsert.length > 0) {
        const { error: menErr } = await (supabaseServer.from('entity_mentions') as any).insert(mentionsToInsert);
        if (menErr && process.env.NODE_ENV === 'development') console.error('[entities/rebuild] insert mentions', menErr);
      }
    }

    const entityCount = entitiesToInsert.length;
    const mentionCount = mentionRows.length;

    return NextResponse.json({ ok: true, entityCount, mentionCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Rebuild failed';
    if (process.env.NODE_ENV === 'development') console.error('[entities/rebuild]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
