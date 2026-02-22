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
      query_id: isArchive ? (query_id ?? null) : (query_id ?? null),
      case_id: isArchive ? (case_id ?? null) : null,
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
        .update({ title: row.title, snippet: row.snippet, captured_at: row.captured_at, query_id: row.query_id })
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
    }

    return NextResponse.json({ saved: data }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to save link';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved] POST catch:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, link_notes } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (link_notes !== undefined && link_notes !== null && typeof link_notes !== 'string') {
      return NextResponse.json({ error: 'link_notes must be a string or null' }, { status: 400 });
    }

    const { data: row, error: fetchError } = await (supabaseServer.from('saved_links') as any)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
    }

    const value = link_notes == null ? null : String(link_notes);
    const { data: updated, error } = await (supabaseServer.from('saved_links') as any)
      .update({ link_notes: value })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[api/saved] PATCH error:', error);
      const msg = (error as { message?: string }).message ?? String(error);
      const hint = /does not exist|undefined column|link_notes/i.test(msg)
        ? ' Run database migrations (e.g. supabase db push).'
        : '';
      return NextResponse.json({ error: msg + hint }, { status: 500 });
    }
    return NextResponse.json({ saved: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update saved link note';
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
