import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

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
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer
      .from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: briefs, error } = await (supabaseServer
      .from('case_briefs') as any)
      .select('*')
      .eq('case_id', caseId)
      .eq('clerk_user_id', userId)
      .order('version_number', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ briefs: briefs || [] });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch briefs' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer
      .from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const briefJson = body.briefJson ?? body.brief_json;
    const evidenceCounts = body.evidenceCounts ?? body.evidence_counts ?? null;

    if (briefJson === undefined) {
      return NextResponse.json(
        { error: 'briefJson is required' },
        { status: 400 }
      );
    }

    const { data: latest } = await (supabaseServer
      .from('case_briefs') as any)
      .select('version_number')
      .eq('case_id', caseId)
      .eq('clerk_user_id', userId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const versionNumber = (latest?.version_number ?? 0) + 1;

    const { data: inserted, error } = await (supabaseServer
      .from('case_briefs') as any)
      .insert({
        case_id: caseId,
        clerk_user_id: userId,
        version_number: versionNumber,
        brief_json: briefJson,
        evidence_counts: evidenceCounts,
      })
      .select('id, version_number, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: inserted.id,
        version_number: inserted.version_number,
        created_at: inserted.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create brief' },
      { status: 500 }
    );
  }
}
