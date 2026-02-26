import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { normalizeInput } from '@/lib/query-utils';
import type { InputType } from '@/lib/query-utils';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const caseId = searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId is required' },
        { status: 400 }
      );
    }

    const { data: rawData, error } = await (supabaseServer
      .from('queries') as any)
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawList = rawData || [];
    const queries = rawList.filter(
      (row: { user_id?: string | null }) => row.user_id == null || row.user_id === userId
    );
    if (process.env.NODE_ENV === 'development') {
      console.log('[api/queries] caseId=%s userId=%s rawCount=%d filteredCount=%d', caseId, userId ?? '(null)', rawList.length, queries.length);
    }
    return NextResponse.json({ queries });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch queries' },
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
    const caseId = body?.caseId;
    const raw_input = typeof body?.raw_input === 'string' ? body.raw_input.trim() : '';
    const input_type: InputType = ['url', 'username', 'quote'].includes(body?.input_type)
      ? body.input_type
      : 'quote';
    const created_at = typeof body?.created_at === 'string' && body.created_at.trim()
      ? body.created_at.trim()
      : undefined;

    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }
    if (!raw_input) {
      return NextResponse.json({ error: 'raw_input is required' }, { status: 400 });
    }

    const normalized_input = normalizeInput(raw_input, input_type);

    const insert: Record<string, unknown> = {
      case_id: caseId,
      raw_input,
      normalized_input,
      input_type,
      status: 'complete',
      user_id: userId,
    };
    if (created_at) insert.created_at = created_at;

    const { data, error } = await (supabaseServer.from('queries') as any)
      .insert(insert)
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[api/queries] POST insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ query: data });
  } catch (error) {
    console.error('POST queries exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create query' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const queryId = searchParams.get('queryId');
    if (!queryId) {
      return NextResponse.json({ error: 'queryId is required' }, { status: 400 });
    }

    const { data: queryRow } = await (supabaseServer.from('queries') as any)
      .select('id, raw_input, normalized_input, input_type, user_id')
      .eq('id', queryId)
      .single();

    if (!queryRow) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 });
    }
    if (queryRow.user_id != null && queryRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const raw_input = typeof body?.raw_input === 'string' ? body.raw_input.trim() : undefined;
    const input_type: InputType | undefined = ['url', 'username', 'quote'].includes(body?.input_type)
      ? body.input_type
      : undefined;
    const created_at = typeof body?.created_at === 'string' ? (body.created_at.trim() || undefined) : undefined;

    const nextRaw = raw_input !== undefined ? raw_input : queryRow.raw_input;
    const nextType: InputType = input_type !== undefined ? input_type : queryRow.input_type;
    const normalized_input = normalizeInput(nextRaw, nextType);

    const update: Record<string, unknown> = {
      normalized_input,
    };
    if (raw_input !== undefined) update.raw_input = raw_input;
    if (input_type !== undefined) update.input_type = input_type;
    if (created_at !== undefined) update.created_at = created_at;

    const { data, error } = await (supabaseServer.from('queries') as any)
      .update(update)
      .eq('id', queryId)
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[api/queries] PATCH update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ query: data });
  } catch (error) {
    console.error('PATCH queries exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update query' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const { data: queryRow } = await (supabaseServer
      .from('queries') as any)
      .select('id, user_id')
      .eq('id', queryId)
      .single();

    if (!queryRow) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 });
    }
    if (queryRow.user_id != null && queryRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await (supabaseServer
      .from('queries') as any)
      .delete()
      .eq('id', queryId)
      .select();

    if (error) {
      console.error('Delete query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: data });
  } catch (error) {
    console.error('Delete query exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete query' },
      { status: 500 }
    );
  }
}
