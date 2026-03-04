import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

const BUCKET = 'voice-notes';
const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
]);

async function ensureCaseAccess(caseId: string, userId: string) {
  const { data: caseRow, error } = await (supabaseServer.from('cases') as any)
    .select('id, user_id')
    .eq('id', caseId)
    .maybeSingle();
  if (error || !caseRow) return { error: 'Case not found', status: 404 as const };
  if (caseRow.user_id != null && caseRow.user_id !== userId) return { error: 'Access denied', status: 403 as const };
  return { caseRow };
}

async function ensureQueryInCase(queryId: string, caseId: string) {
  const { data: q, error } = await (supabaseServer.from('queries') as any)
    .select('id')
    .eq('id', queryId)
    .eq('case_id', caseId)
    .maybeSingle();
  if (error || !q) return false;
  return true;
}

export async function GET(
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

    const queryId = request.nextUrl.searchParams.get('queryId');

    let q = (supabaseServer.from('voice_notes') as any)
      .select('*')
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .order('recorded_at', { ascending: true });
    if (queryId) q = q.eq('query_id', queryId);
    const { data: rows, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const notes = await Promise.all(
      (rows || []).map(async (row: { storage_path: string; [k: string]: unknown }) => {
        const { data: signed } = await supabaseServer.storage.from(BUCKET).createSignedUrl(row.storage_path, 3600);
        return { ...row, url: signed?.signedUrl ?? null };
      })
    );

    return NextResponse.json({ voiceNotes: notes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch voice notes';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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

    const formData = await request.formData();
    const queryId = String(formData.get('queryId') ?? '').trim();
    const file = formData.get('file');

    if (!queryId) return NextResponse.json({ error: 'queryId required' }, { status: 400 });
    const inCase = await ensureQueryInCase(queryId, caseId);
    if (!inCase) return NextResponse.json({ error: 'Query not in case' }, { status: 400 });

    if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Unsupported audio type' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 400 });

    const ext = file.name.split('.').pop() || 'webm';
    const storagePath = `${userId}/${caseId}/${queryId}/${crypto.randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabaseServer.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadErr) {
      if (process.env.NODE_ENV === 'development') console.error('[voice] upload error:', uploadErr);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: row, error: insertErr } = await (supabaseServer.from('voice_notes') as any)
      .insert({
        user_id: userId,
        case_id: caseId,
        query_id: queryId,
        storage_path: storagePath,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (insertErr) {
      await supabaseServer.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { data: signed } = await supabaseServer.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
    return NextResponse.json({ voiceNote: { ...row, url: signed?.signedUrl ?? null } }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
