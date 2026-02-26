/**
 * Phase 3 (Cohesion): List top entities for a case.
 * GET /api/cases/[caseId]/entities
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

const TOP_N = 20;

export async function GET(
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

    const { data: entities, error } = await (supabaseServer.from('case_entities') as any)
      .select('id, name, entity_type, mention_count')
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .order('mention_count', { ascending: false })
      .limit(TOP_N);

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[entities] GET', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entities: entities ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch entities';
    if (process.env.NODE_ENV === 'development') console.error('[entities]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
