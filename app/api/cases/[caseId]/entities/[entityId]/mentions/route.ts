/**
 * Phase 3 (Cohesion): List mentions for an entity.
 * GET /api/cases/[caseId]/entities/[entityId]/mentions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { caseId: string; entityId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseId = params.caseId;
    const entityId = params.entityId;
    if (!caseId || !entityId) {
      return NextResponse.json({ error: 'caseId and entityId required' }, { status: 400 });
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

    const { data: entity, error: entErr } = await (supabaseServer.from('case_entities') as any)
      .select('id, name, entity_type')
      .eq('id', entityId)
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .maybeSingle();

    if (entErr || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const { data: mentions, error } = await (supabaseServer.from('entity_mentions') as any)
      .select('id, evidence_kind, evidence_id, query_id, context_snippet, created_at')
      .eq('entity_id', entityId)
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[entities/mentions] GET', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entity, mentions: mentions ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch mentions';
    if (process.env.NODE_ENV === 'development') console.error('[entities/mentions]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
