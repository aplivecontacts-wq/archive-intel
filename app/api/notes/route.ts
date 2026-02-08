import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const queryId = searchParams.get('queryId');

    if (!queryId) {
      return NextResponse.json(
        { error: 'queryId is required' },
        { status: 400 }
      );
    }

    const { data: rawNote, error } = await (supabaseServer
      .from('notes') as any)
      .select('*')
      .eq('query_id', queryId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const note =
      rawNote && (rawNote.user_id == null || rawNote.user_id === userId)
        ? rawNote
        : null;
    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { queryId, content } = body;

    if (!queryId) {
      return NextResponse.json(
        { error: 'queryId is required' },
        { status: 400 }
      );
    }

    const { data: existing } = await (supabaseServer
      .from('notes') as any)
      .select('*')
      .eq('query_id', queryId)
      .maybeSingle();

    if (existing) {
      if (existing.user_id != null && existing.user_id !== userId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      const { data, error } = await (supabaseServer
        .from('notes') as any)
        .update({
          content,
          updated_at: new Date().toISOString(),
          ...(existing.user_id == null ? { user_id: userId } : {}),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ note: data });
    } else {
      const { data, error } = await (supabaseServer
        .from('notes') as any)
        .insert({ query_id: queryId, content, user_id: userId })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ note: data }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save note' },
      { status: 500 }
    );
  }
}
