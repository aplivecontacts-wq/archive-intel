/**
 * Phase 5 (Cohesion): Import case_tasks from a brief's verification_tasks and critical_gaps.
 * POST /api/cases/[caseId]/tasks/import-from-brief
 * Body: { briefId?: string } — if omitted, uses latest brief for the case.
 * No AI; deterministic; dedupes by normalized title.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

function normalizeTitle(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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

    const body = await request.json().catch(() => ({}));
    const briefId = typeof body.briefId === 'string' ? body.briefId.trim() || null : null;

    let brief: { brief_json?: unknown } | null = null;
    if (briefId) {
      const { data: b, error: briefErr } = await (supabaseServer.from('case_briefs') as any)
        .select('brief_json')
        .eq('id', briefId)
        .eq('case_id', caseId)
        .eq('clerk_user_id', userId)
        .maybeSingle();
      if (briefErr || !b) {
        return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
      }
      brief = b;
    } else {
      const { data: b, error: briefErr } = await (supabaseServer.from('case_briefs') as any)
        .select('brief_json')
        .eq('case_id', caseId)
        .eq('clerk_user_id', userId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (briefErr || !b) {
        return NextResponse.json({ error: 'No brief found for this case' }, { status: 404 });
      }
      brief = b;
    }

    const bj = brief?.brief_json && typeof brief.brief_json === 'object' ? brief.brief_json as Record<string, unknown> : {};
    const verificationTasks = Array.isArray(bj.verification_tasks) ? bj.verification_tasks : [];
    const criticalGaps = Array.isArray(bj.critical_gaps) ? bj.critical_gaps : [];

    const { data: existingTasks } = await (supabaseServer.from('case_tasks') as any)
      .select('title')
      .eq('case_id', caseId)
      .eq('user_id', userId);
    const existingNorm = new Set(
      (existingTasks ?? []).map((t: { title: string }) => normalizeTitle(t.title))
    );

    const toInsert: { title: string; detail: string | null; priority: string }[] = [];

    for (const vt of verificationTasks) {
      const task = vt && typeof vt === 'object' ? vt as Record<string, unknown> : {};
      const title = typeof task.task === 'string' ? task.task.trim() : '';
      if (!title || existingNorm.has(normalizeTitle(title))) continue;
      existingNorm.add(normalizeTitle(title));
      toInsert.push({
        title,
        detail: null,
        priority: ['high', 'medium', 'low'].includes(task.priority as string) ? (task.priority as string) : 'medium',
      });
    }

    for (const cg of criticalGaps) {
      const gap = cg && typeof cg === 'object' ? cg as Record<string, unknown> : {};
      const missing = typeof gap.missing_item === 'string' ? gap.missing_item.trim() : '';
      if (!missing) continue;
      const title = `Gap: ${missing}`;
      if (existingNorm.has(normalizeTitle(title))) continue;
      existingNorm.add(normalizeTitle(title));
      const detail = typeof gap.why_it_matters === 'string' ? gap.why_it_matters.trim() || null : null;
      toInsert.push({
        title,
        detail,
        priority: 'medium',
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ imported: 0, message: 'No new tasks to import' });
    }

    const rows = toInsert.map((r) => ({
      case_id: caseId,
      user_id: userId,
      title: r.title,
      detail: r.detail,
      priority: r.priority,
      status: 'open',
      source: 'ai',
      linked_evidence_ids: null,
    }));

    const { error: insertErr } = await (supabaseServer.from('case_tasks') as any).insert(rows);
    if (insertErr) {
      if (process.env.NODE_ENV === 'development') console.error('[tasks/import-from-brief]', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    return NextResponse.json({ imported: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Import failed';
    if (process.env.NODE_ENV === 'development') console.error('[tasks/import-from-brief]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
