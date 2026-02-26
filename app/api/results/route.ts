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

    const { data: rawData, error } = await (supabaseServer
      .from('results') as any)
      .select('*')
      .eq('query_id', queryId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = (rawData || []).filter(
      (row: { user_id?: string | null }) =>
        row.user_id == null || row.user_id === userId || (row as any).user_id === undefined
    );
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}

/** Create a manual result (source: 'note') for a query. Body: { queryId, title, url?, snippet? } */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const queryId = body?.queryId;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const url = typeof body?.url === 'string' ? body.url.trim() || null : null;
    const snippet = typeof body?.snippet === 'string' ? body.snippet.trim() || null : null;

    if (!queryId) {
      return NextResponse.json({ error: 'queryId is required' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const { data, error } = await (supabaseServer.from('results') as any)
      .insert({
        query_id: queryId,
        source: 'note',
        title,
        url: url ?? null,
        snippet: snippet ?? null,
        confidence: 1,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[api/results] POST insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ result: data });
  } catch (error) {
    console.error('POST results exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create result' },
      { status: 500 }
    );
  }
}

