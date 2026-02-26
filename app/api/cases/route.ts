import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rawData, error } = await (supabaseServer
      .from('cases') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const cases = (rawData || []).filter(
      (row: { user_id?: string | null }) => row.user_id == null || row.user_id === userId
    );
    return NextResponse.json({ cases });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch cases' },
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
    const { title, tags = [], objective } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const insertPayload: Record<string, unknown> = { title, tags, user_id: userId };
    if (objective !== undefined) {
      insertPayload.objective = typeof objective === 'string' ? objective.trim() || null : null;
    }

    const { data, error } = await (supabaseServer
      .from('cases') as any)
      .insert(insertPayload as Record<string, unknown>)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ case: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create case' },
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
    const caseId = searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId is required' },
        { status: 400 }
      );
    }

    const { data: caseRow } = await (supabaseServer
      .from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .single();

    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await (supabaseServer
      .from('cases') as any)
      .delete()
      .eq('id', caseId)
      .select();

    if (error) {
      console.error('Delete case error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: data });
  } catch (error) {
    console.error('Delete case exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete case' },
      { status: 500 }
    );
  }
}
