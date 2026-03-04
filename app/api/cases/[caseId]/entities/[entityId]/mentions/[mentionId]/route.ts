/**
 * DELETE a single entity mention. Decrements entity mention_count; removes entity if 0.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { caseId: string; entityId: string; mentionId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, entityId, mentionId } = params;
    if (!caseId || !entityId || !mentionId) {
      return NextResponse.json({ error: 'caseId, entityId, mentionId required' }, { status: 400 });
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

    const { data: mention, error: mentionErr } = await (supabaseServer.from('entity_mentions') as any)
      .select('id, entity_id')
      .eq('id', mentionId)
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .eq('entity_id', entityId)
      .maybeSingle();

    if (mentionErr || !mention) {
      return NextResponse.json({ error: 'Mention not found' }, { status: 404 });
    }

    const { error: delErr } = await (supabaseServer.from('entity_mentions') as any)
      .delete()
      .eq('id', mentionId)
      .eq('case_id', caseId)
      .eq('user_id', userId);

    if (delErr) {
      if (process.env.NODE_ENV === 'development') console.error('[entities/mentions] DELETE', delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const { data: entityRow, error: entErr } = await (supabaseServer.from('case_entities') as any)
      .select('id, mention_count')
      .eq('id', entityId)
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!entErr && entityRow) {
      const newCount = Math.max(0, (entityRow.mention_count ?? 1) - 1);
      if (newCount === 0) {
        await (supabaseServer.from('case_entities') as any)
          .delete()
          .eq('id', entityId)
          .eq('case_id', caseId)
          .eq('user_id', userId);
      } else {
        await (supabaseServer.from('case_entities') as any)
          .update({ mention_count: newCount })
          .eq('id', entityId)
          .eq('case_id', caseId)
          .eq('user_id', userId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete mention';
    if (process.env.NODE_ENV === 'development') console.error('[entities/mentions] DELETE', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
