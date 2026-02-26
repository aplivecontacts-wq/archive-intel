import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: links, error } = await (supabaseServer.from('saved_links') as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[api/saved] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = links || [];
    const linkIds = list.map((l: { id: string }) => l.id);
    const savedWithNotes = list.map((l: Record<string, unknown>) => ({ ...l, notes: [] as { id: string; content: string; created_at: string }[] }));

    if (linkIds.length > 0) {
      const { data: notesRows, error: notesErr } = await (supabaseServer.from('saved_link_notes') as any)
        .select('id, saved_link_id, content, created_at')
        .in('saved_link_id', linkIds)
        .order('created_at', { ascending: true });
      if (!notesErr && notesRows?.length) {
        const byLink = new Map<string, { id: string; content: string; created_at: string }[]>();
        for (const n of notesRows) {
          const arr = byLink.get(n.saved_link_id) ?? [];
          arr.push({ id: n.id, content: n.content, created_at: n.created_at });
          byLink.set(n.saved_link_id, arr);
        }
        for (const item of savedWithNotes) {
          item.notes = byLink.get(item.id as string) ?? [];
        }
      }
    }

    return NextResponse.json({ saved: savedWithNotes });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch saved links';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved] GET catch:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { source, url, title, snippet, captured_at, query_id, case_id } = body;

    if (!source || !url) {
      return NextResponse.json(
        { error: 'source and url are required' },
        { status: 400 }
      );
    }

    if (!['archive', 'query', 'official'].includes(source)) {
      return NextResponse.json(
        { error: 'source must be archive, query, or official' },
        { status: 400 }
      );
    }

    const isArchive = source === 'archive';
    const trimmedUrl = String(url).trim();
    const row = {
      user_id: userId,
      source,
      url: trimmedUrl,
      title: title ?? null,
      snippet: snippet ?? null,
      captured_at: captured_at ?? null,
      query_id: query_id ?? null,
      case_id: case_id ?? null,
    };

    const tbl = supabaseServer.from('saved_links') as any;

    // Select-then-insert/update to avoid partial unique index upsert issues.
    let existing;
    if (isArchive) {
      const q = tbl.select('id').eq('user_id', userId).eq('url', trimmedUrl).eq('source', source);
      if (row.case_id != null) q.eq('case_id', row.case_id);
      else q.is('case_id', null);
      const { data: found, error: findErr } = await q.maybeSingle();
      if (findErr) {
        if (process.env.NODE_ENV === 'development') console.error('[api/saved] POST archive find error:', findErr);
        return NextResponse.json({ error: findErr.message }, { status: 500 });
      }
      existing = found;
    } else {
      const { data: found, error: findErr } = await tbl
        .select('id')
        .eq('user_id', userId)
        .eq('url', trimmedUrl)
        .eq('source', source)
        .maybeSingle();
      if (findErr) {
        if (process.env.NODE_ENV === 'development') console.error('[api/saved] POST result find error:', findErr);
        return NextResponse.json({ error: findErr.message }, { status: 500 });
      }
      existing = found;
    }

    let data;
    if (existing) {
      const { data: updated, error: updateErr } = await tbl
        .update({ title: row.title, snippet: row.snippet, captured_at: row.captured_at, query_id: row.query_id, case_id: row.case_id })
        .eq('id', existing.id)
        .select()
        .single();
      if (updateErr) {
        if (process.env.NODE_ENV === 'development') console.error('[api/saved] POST update error:', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      data = updated;
    } else {
      const { data: inserted, error: insertErr } = await tbl.insert(row).select().single();
      if (insertErr) {
        if (process.env.NODE_ENV === 'development') console.error('[api/saved] POST insert error:', insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      data = inserted;
      // Auto-run extract key facts when a new link is saved with a case (so Saved tab shows key facts without a click).
      const caseId = data?.case_id;
      if (caseId && data?.id) {
        const origin = request.nextUrl?.origin || '';
        const cookie = request.headers.get('cookie');
        const authz = request.headers.get('authorization');
        const headers: Record<string, string> = {};
        if (cookie) headers.cookie = cookie;
        if (authz) headers.authorization = authz;
        if (origin) {
          const extractUrl = `${origin}/api/cases/${caseId}/saved-links/${data.id}/extract`;
          fetch(extractUrl, { method: 'POST', cache: 'no-store', headers: Object.keys(headers).length ? headers : undefined }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ saved: data }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to save link';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved] POST catch:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const SOURCE_TIER_VALUES = new Set(['primary', 'secondary', null]);

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, link_notes, source_tier } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (link_notes !== undefined && link_notes !== null && typeof link_notes !== 'string') {
      return NextResponse.json({ error: 'link_notes must be a string or null' }, { status: 400 });
    }
    if (source_tier !== undefined && !SOURCE_TIER_VALUES.has(source_tier)) {
      return NextResponse.json(
        { error: 'source_tier must be "primary", "secondary", or null' },
        { status: 400 }
      );
    }

    const { data: row, error: fetchError } = await (supabaseServer.from('saved_links') as any)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (link_notes !== undefined) {
      updates.link_notes = link_notes == null ? null : String(link_notes);
    }
    if (source_tier !== undefined) {
      updates.source_tier = source_tier;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Provide link_notes and/or source_tier to update' }, { status: 400 });
    }

    const { data: updated, error } = await (supabaseServer.from('saved_links') as any)
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[api/saved] PATCH error:', error);
      const msg = (error as { message?: string }).message ?? String(error);
      const hint = /does not exist|undefined column|link_notes|source_tier/i.test(msg)
        ? ' Run database migrations (e.g. supabase db push).'
        : '';
      return NextResponse.json({ error: msg + hint }, { status: 500 });
    }
    return NextResponse.json({ saved: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update saved link';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved] PATCH catch:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const url = searchParams.get('url');
    const source = searchParams.get('source');

    if (id) {
      const { data: row, error: fetchError } = await (supabaseServer.from('saved_links') as any)
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError || !row) {
        return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
      }

      const { error } = await (supabaseServer.from('saved_links') as any)
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[api/saved] DELETE by id error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (url && source) {
      const queryIdParam = searchParams.get('query_id');
      const caseIdParam = searchParams.get('case_id');
      const q = (supabaseServer.from('saved_links') as any)
        .delete()
        .eq('user_id', userId)
        .eq('url', url)
        .eq('source', source);
      if (source === 'archive') {
        if (caseIdParam != null && caseIdParam !== '') q.eq('case_id', caseIdParam);
        else q.is('case_id', null);
      } else if (queryIdParam != null && queryIdParam !== '') {
        q.eq('query_id', queryIdParam);
      }
      const { error } = await q;
      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[api/saved] DELETE error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: 'Provide id or (url and source)' },
      { status: 400 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to remove saved link';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved] DELETE catch:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
