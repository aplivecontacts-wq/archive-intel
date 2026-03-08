import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { transcribeAudio } from '@/lib/ai/whisper';

export const dynamic = 'force-dynamic';
const BUCKET = 'voice-notes';

/** Get a Buffer from Supabase storage download (Blob, Buffer, or ArrayBuffer). */
async function toBuffer(obj: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(obj)) return obj;
  if (obj instanceof ArrayBuffer) return Buffer.from(obj);
  if (obj instanceof Uint8Array) return Buffer.from(obj);
  if (typeof (obj as Blob).arrayBuffer === 'function') {
    const ab = await (obj as Blob).arrayBuffer();
    return Buffer.from(ab);
  }
  throw new Error('Unsupported download result type');
}

async function ensureCaseAccess(caseId: string, userId: string) {
  const { data: caseRow, error } = await (supabaseServer.from('cases') as any)
    .select('id, user_id')
    .eq('id', caseId)
    .maybeSingle();
  if (error || !caseRow) return { error: 'Case not found', status: 404 as const };
  if (caseRow.user_id != null && caseRow.user_id !== userId) return { error: 'Access denied', status: 403 as const };
  return { caseRow };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const caseId = params?.caseId;
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    const access = await ensureCaseAccess(caseId, userId);
    if ('status' in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const queryId = request.nextUrl.searchParams.get('queryId') ?? undefined;

    let q = (supabaseServer.from('voice_notes') as any)
      .select('id, storage_path, transcript')
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .order('recorded_at', { ascending: true });
    if (queryId) q = q.eq('query_id', queryId);
    const { data: notes, error: listErr } = await q;
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const toTranscribe = (notes || []).filter((n: { transcript?: string | null }) => !n.transcript?.trim());
    const updated: string[] = [];

    let firstError: string | null = null;
    for (const note of toTranscribe) {
      const { data: obj, error: downloadErr } = await supabaseServer.storage.from(BUCKET).download(note.storage_path);
      if (downloadErr) {
        firstError = firstError ?? `Download failed: ${downloadErr.message}`;
        if (process.env.NODE_ENV === 'development') console.error('[voice/organize] download error:', downloadErr);
        continue;
      }
      if (!obj) continue;
      let buffer: Buffer;
      try {
        buffer = await toBuffer(obj);
      } catch (bufErr) {
        firstError = firstError ?? (bufErr instanceof Error ? bufErr.message : 'Invalid download data');
        continue;
      }
      try {
        const transcript = await transcribeAudio(buffer, 'audio/webm');
        const { error: upErr } = await (supabaseServer.from('voice_notes') as any)
          .update({ transcript })
          .eq('id', note.id);
        if (!upErr) updated.push(note.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Transcription failed';
        firstError = firstError ?? msg;
        if (process.env.NODE_ENV === 'development') console.error('[voice/organize] transcribe error:', e);
      }
    }

    if (toTranscribe.length > 0 && updated.length === 0 && firstError) {
      return NextResponse.json({ error: firstError }, { status: 500 });
    }
    return NextResponse.json({ organized: updated.length, transcribed: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Organize failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
