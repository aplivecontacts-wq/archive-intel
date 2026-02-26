import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { format } from 'date-fns';
import { supabaseServer } from '@/lib/supabase-server';
import { buildBriefPdf } from '@/lib/pdf/brief-to-pdf';

export async function GET(
  _request: Request,
  { params }: { params: { caseId: string; briefId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, briefId } = params;
    if (!caseId || !briefId) {
      return NextResponse.json(
        { error: 'caseId and briefId are required' },
        { status: 400 }
      );
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer
      .from('cases') as any)
      .select('id, user_id, title')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: brief, error } = await (supabaseServer
      .from('case_briefs') as any)
      .select('brief_json, version_number, created_at')
      .eq('id', briefId)
      .eq('case_id', caseId)
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    const caseTitle = caseRow.title ?? 'Untitled Case';
    const versionNumber = brief.version_number ?? 1;
    const createdAt = brief.created_at
      ? format(new Date(brief.created_at), 'yyyy-MM-dd HH:mm')
      : '';

    const { data: savedRaw } = await (supabaseServer.from('saved_links') as any)
      .select('id, source, url, title, captured_at, source_tier, created_at')
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const linkIds = (savedRaw || []).map((s: { id: string }) => s.id);
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

    const saved_links_with_notes = (savedRaw || []).map((s: Record<string, unknown>) => ({
      source: s.source,
      url: s.url,
      title: s.title,
      source_tier: s.source_tier ?? null,
      notes: notesByLink[s.id as string] ?? [],
    }));

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = buildBriefPdf(
        caseTitle,
        versionNumber,
        createdAt,
        brief.brief_json,
        saved_links_with_notes
      );
    } catch (pdfError) {
      const message =
        pdfError instanceof Error ? pdfError.message : 'PDF generation failed';
      return NextResponse.json(
        { error: `PDF generation failed: ${message}` },
        { status: 500 }
      );
    }

    const filename = `brief-v${versionNumber}.pdf`;
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
