import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { validateBriefJson } from '@/lib/ai/brief-schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { caseId: string; briefId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, briefId } = params;
    if (!caseId || !briefId) {
      return NextResponse.json(
        { error: 'caseId and briefId are required' },
        { status: 400 }
      );
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer
      .from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: brief, error } = await (supabaseServer
      .from('case_briefs') as any)
      .select('*')
      .eq('id', briefId)
      .eq('case_id', caseId)
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    // Include saved links + per-link notes for this case so the brief view can show evidence used.
    const { data: savedRaw } = await (supabaseServer.from('saved_links') as any)
      .select('id, source, url, title, captured_at, source_tier, created_at')
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const linkIds = (savedRaw || []).map((s: { id: string }) => s.id);
    let notesByLink: Record<string, { id: string; content: string; created_at: string }[]> = {};
    if (linkIds.length > 0) {
      const { data: notesRaw } = await (supabaseServer.from('saved_link_notes') as any)
        .select('id, saved_link_id, content, created_at')
        .in('saved_link_id', linkIds)
        .order('created_at', { ascending: true });
      const byLink = new Map<string, { id: string; content: string; created_at: string }[]>();
      for (const n of notesRaw || []) {
        const arr = byLink.get(n.saved_link_id) ?? [];
        arr.push({ id: n.id, content: n.content, created_at: n.created_at });
        byLink.set(n.saved_link_id, arr);
      }
      notesByLink = Object.fromEntries(byLink);
    }

    const saved_links_with_notes = (savedRaw || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      source: s.source,
      url: s.url,
      title: s.title,
      captured_at: s.captured_at,
      source_tier: s.source_tier ?? null,
      created_at: s.created_at,
      notes: notesByLink[s.id as string] ?? [],
    }));

    // #region agent log
    if (process.env.NODE_ENV !== 'production') {
      const bj = brief?.brief_json;
      const typ = typeof bj;
      const keys = typ === 'object' && bj != null && !Array.isArray(bj) ? Object.keys(bj as object) : [];
      const arr = (name: string) => {
        const v = (bj as Record<string, unknown>)?.[name];
        return Array.isArray(v) ? v.length : v === undefined ? 'undefined' : typeof v;
      };
      const payload = {
        sessionId: '726d5f',
        hypothesisId: 'A',
        location: 'app/api/cases/[caseId]/briefs/[briefId]/route.ts:GET',
        message: 'GET brief: brief_json shape before return',
        data: {
          brief_json_typeof: typ,
          brief_json_keys: keys,
          working_timeline_len: arr('working_timeline'),
          key_entities_len: arr('key_entities'),
          contradictions_tensions_len: arr('contradictions_tensions'),
          evidence_strength_len: arr('evidence_strength'),
          verification_tasks_len: arr('verification_tasks'),
          saved_links_with_notes_len: saved_links_with_notes?.length ?? 0,
        },
        timestamp: Date.now(),
      };
      console.log('[brief GET]', payload.data);
      fetch('http://127.0.0.1:7242/ingest/e0a55016-0dba-46c8-8112-7b93c9c9c645', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '726d5f' }, body: JSON.stringify(payload) }).catch(() => {});
    }
    // #endregion

    return NextResponse.json({ brief, saved_links_with_notes });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch brief' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { caseId: string; briefId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, briefId } = params;
    if (!caseId || !briefId) {
      return NextResponse.json(
        { error: 'caseId and briefId are required' },
        { status: 400 }
      );
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer
      .from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const user_note = typeof body.user_note === 'string' ? body.user_note : null;
    const updatePayload: Record<string, unknown> = { user_note };
    if (body.brief_json !== undefined) {
      let validated;
      try {
        validated = validateBriefJson(body.brief_json);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid brief schema';
        return NextResponse.json({ error: `Brief validation failed: ${msg}` }, { status: 400 });
      }
      updatePayload.brief_json = validated;
    }
    const { error } = await (supabaseServer
      .from('case_briefs') as any)
      .update(updatePayload)
      .eq('id', briefId)
      .eq('case_id', caseId)
      .eq('clerk_user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update brief' },
      { status: 500 }
    );
  }
}
