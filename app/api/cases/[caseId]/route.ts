import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * PATCH /api/cases/[caseId] — update case title and/or objective.
 */
export async function PATCH(
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
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }

    const { data: caseRow, error: fetchErr } = await (supabaseServer
      .from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (fetchErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const t = typeof body.title === 'string' ? body.title.trim() : '';
      if (!t) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      }
      updates.title = t;
    }
    if (body.objective !== undefined) {
      updates.objective =
        typeof body.objective === 'string' ? (body.objective.trim() || null) : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await (supabaseServer
      .from('cases') as any)
      .update(updates)
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ case: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update case' },
      { status: 500 }
    );
  }
}
