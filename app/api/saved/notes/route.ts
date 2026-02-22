import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { saved_link_id, content } = body;

    if (!saved_link_id || typeof saved_link_id !== 'string') {
      return NextResponse.json({ error: 'saved_link_id is required' }, { status: 400 });
    }

    const trimmed = String(content ?? '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const { data: link, error: linkErr } = await (supabaseServer.from('saved_links') as any)
      .select('id')
      .eq('id', saved_link_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (linkErr || !link) {
      return NextResponse.json({ error: 'Saved link not found or access denied' }, { status: 404 });
    }

    const { data: note, error } = await (supabaseServer.from('saved_link_notes') as any)
      .insert({ saved_link_id, content: trimmed })
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[api/saved/notes] POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to add note';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved/notes] POST catch:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data: note, error: fetchErr } = await (supabaseServer.from('saved_link_notes') as any)
      .select('id, saved_link_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const { data: link } = await (supabaseServer.from('saved_links') as any)
      .select('id')
      .eq('id', note.saved_link_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: 'Access denied' }, { status: 404 });
    }

    const { error } = await (supabaseServer.from('saved_link_notes') as any)
      .delete()
      .eq('id', id);

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[api/saved/notes] DELETE error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete note';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved/notes] DELETE catch:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
