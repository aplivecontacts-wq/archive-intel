/**
 * Phase 5 (Cohesion): Case Tasks — GET list, POST create (manual).
 * GET /api/cases/[caseId]/tasks
 * POST /api/cases/[caseId]/tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

async function assertCaseAccess(caseId: string, userId: string) {
  const { data: caseRow, error: caseErr } = await (supabaseServer.from('cases') as any)
    .select('id, user_id')
    .eq('id', caseId)
    .maybeSingle();
  if (caseErr || !caseRow) {
    return { error: NextResponse.json({ error: 'Case not found' }, { status: 404 }) };
  }
  if (caseRow.user_id != null && caseRow.user_id !== userId) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }
  return { caseRow };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const caseId = params.caseId;
    if (!caseId) {
      return NextResponse.json({ error: 'caseId required' }, { status: 400 });
    }
    const access = await assertCaseAccess(caseId, userId);
    if (access.error) return access.error;

    const { data: tasks, error } = await (supabaseServer.from('case_tasks') as any)
      .select('*')
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[tasks] GET', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ tasks: tasks ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tasks';
    if (process.env.NODE_ENV === 'development') console.error('[tasks]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
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
      return NextResponse.json({ error: 'caseId required' }, { status: 400 });
    }
    const access = await assertCaseAccess(caseId, userId);
    if (access.error) return access.error;

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }
    const priority = ['high', 'medium', 'low'].includes(body.priority) ? body.priority : 'medium';
    const detail = typeof body.detail === 'string' ? body.detail.trim() || null : null;

    const { data: inserted, error } = await (supabaseServer.from('case_tasks') as any)
      .insert({
        case_id: caseId,
        user_id: userId,
        title,
        detail,
        priority,
        status: 'open',
        source: 'manual',
      })
      .select('id')
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[tasks] POST', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ taskId: inserted?.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create task';
    if (process.env.NODE_ENV === 'development') console.error('[tasks]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
