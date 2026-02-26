/**
 * Phase 5 (Cohesion): PATCH case task (status, priority, title, detail).
 * PATCH /api/cases/[caseId]/tasks/[taskId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { caseId: string; taskId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const caseId = params.caseId;
    const taskId = params.taskId;
    if (!caseId || !taskId) {
      return NextResponse.json({ error: 'caseId and taskId required' }, { status: 400 });
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer.from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();
    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: taskRow, error: taskErr } = await (supabaseServer.from('case_tasks') as any)
      .select('id')
      .eq('id', taskId)
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .maybeSingle();
    if (taskErr || !taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (['open', 'in_progress', 'done'].includes(body.status)) {
      updates.status = body.status;
    }
    if (['high', 'medium', 'low'].includes(body.priority)) {
      updates.priority = body.priority;
    }
    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (t) updates.title = t;
    }
    if (typeof body.detail === 'string') {
      updates.detail = body.detail.trim() || null;
    }

    const { error: updateErr } = await (supabaseServer.from('case_tasks') as any)
      .update(updates)
      .eq('id', taskId)
      .eq('case_id', caseId)
      .eq('user_id', userId);

    if (updateErr) {
      if (process.env.NODE_ENV === 'development') console.error('[tasks] PATCH', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update task';
    if (process.env.NODE_ENV === 'development') console.error('[tasks]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
