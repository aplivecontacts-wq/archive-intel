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
