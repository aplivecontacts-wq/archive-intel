import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { format } from 'date-fns';
import { supabaseServer } from '@/lib/supabase-server';
import { buildBriefPdf, buildCaseOverviewPdf } from '@/lib/pdf/brief-to-pdf';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cases/[caseId]/export
 * Full case export: single PDF (latest brief if available, otherwise case overview with queries + saved links).
 */
export async function GET(
  _request: Request,
  { params }: { params: { caseId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseId = params?.caseId;
    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer
      .from('cases') as any)
      .select('id, title, objective, created_at, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const [{ data: queries }, { data: briefs }, { data: savedLinks }] = await Promise.all([
      (supabaseServer.from('queries') as any)
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true }),
      (supabaseServer.from('case_briefs') as any)
        .select('id, version_number, created_at')
        .eq('case_id', caseId)
        .eq('clerk_user_id', userId)
        .order('version_number', { ascending: false }),
      (supabaseServer.from('saved_links') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
    ]);

    const queryIds = (queries || []).map((q: { id: string }) => q.id);
    let results: unknown[] = [];
    let notes: unknown[] = [];
    if (queryIds.length > 0) {
      const [resResult, resNotes] = await Promise.all([
        (supabaseServer.from('results') as any)
          .select('*')
          .in('query_id', queryIds)
          .order('created_at', { ascending: false }),
        (supabaseServer.from('notes') as any)
          .select('*')
          .in('query_id', queryIds)
          .order('created_at', { ascending: true }),
      ]);
      results = resResult.data ?? [];
      notes = resNotes.data ?? [];
    }

    const linkIds = (savedLinks || []).map((l: { id: string }) => l.id);
    let notesByLink: Record<string, { content: string; created_at: string }[]> = {};
    if (linkIds.length > 0) {
      const { data: notesRaw } = await (supabaseServer.from('saved_link_notes') as any)
        .select('saved_link_id, content, created_at')
        .in('saved_link_id', linkIds)
        .order('created_at', { ascending: true });
      const byLink = new Map<string, { content: string; created_at: string }[]>();
      for (const n of notesRaw || []) {
        const arr = byLink.get(n.saved_link_id) ?? [];
        arr.push({ content: n.content, created_at: n.created_at });
        byLink.set(n.saved_link_id, arr);
      }
      notesByLink = Object.fromEntries(byLink);
    }

    let pdfBuffer: Uint8Array;
    const latestBrief = (briefs || [])[0];
    if (latestBrief) {
      const { data: briefRow } = await (supabaseServer.from('case_briefs') as any)
        .select('brief_json, version_number, created_at')
        .eq('id', latestBrief.id)
        .maybeSingle();
      if (briefRow?.brief_json) {
        const saved_links_with_notes = (savedLinks || []).map((s: Record<string, unknown>) => ({
          source: s.source,
          url: s.url,
          title: s.title,
          source_tier: s.source_tier ?? null,
          notes: notesByLink[s.id as string] ?? [],
        }));
        try {
          const briefJson = typeof briefRow.brief_json === 'string'
            ? JSON.parse(briefRow.brief_json)
            : briefRow.brief_json;
          pdfBuffer = buildBriefPdf(
            caseRow.title ?? 'Untitled Case',
            briefRow.version_number ?? 1,
            briefRow.created_at ? format(new Date(briefRow.created_at), 'yyyy-MM-dd HH:mm') : '',
            briefJson,
            saved_links_with_notes
          );
        } catch {
          pdfBuffer = buildCaseOverviewPdf({
            caseTitle: caseRow.title ?? 'Untitled Case',
            objective: caseRow.objective ?? null,
            exportedAt: new Date().toISOString(),
            queries: (queries || []).map((q: { id: string; title?: string | null; created_at: string }) => ({
              id: q.id,
              title: q.title,
              created_at: q.created_at,
            })),
            savedLinks: (savedLinks || []).map((s: { url: string; title?: string | null; source: string }) => ({
              url: s.url,
              title: s.title,
              source: s.source,
            })),
          });
        }
      } else {
        pdfBuffer = buildCaseOverviewPdf({
          caseTitle: caseRow.title ?? 'Untitled Case',
          objective: caseRow.objective ?? null,
          exportedAt: new Date().toISOString(),
          queries: (queries || []).map((q: { id: string; title?: string | null; created_at: string }) => ({
            id: q.id,
            title: q.title,
            created_at: q.created_at,
          })),
          savedLinks: (savedLinks || []).map((s: { url: string; title?: string | null; source: string }) => ({
            url: s.url,
            title: s.title,
            source: s.source,
          })),
        });
      }
    } else {
      pdfBuffer = buildCaseOverviewPdf({
        caseTitle: caseRow.title ?? 'Untitled Case',
        objective: caseRow.objective ?? null,
        exportedAt: new Date().toISOString(),
        queries: (queries || []).map((q: { id: string; title?: string | null; created_at: string }) => ({
          id: q.id,
          title: q.title,
          created_at: q.created_at,
        })),
        savedLinks: (savedLinks || []).map((s: { url: string; title?: string | null; source: string }) => ({
          url: s.url,
          title: s.title,
          source: s.source,
        })),
      });
    }

    const safeTitle = (caseRow.title || 'case').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80);
    const filename = `case-export-${safeTitle}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
