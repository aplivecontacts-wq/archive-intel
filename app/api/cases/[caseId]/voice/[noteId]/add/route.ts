import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { transcribeAudio } from '@/lib/ai/whisper';

const BUCKET = 'voice-notes';
const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a']);

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string; noteId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { caseId, noteId } = params ?? {};
    if (!caseId || !noteId) return NextResponse.json({ error: 'caseId and noteId required' }, { status: 400 });

    const { data: note, error: noteErr } = await (supabaseServer.from('voice_notes') as any)
      .select('id, user_id')
      .eq('id', noteId)
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .maybeSingle();
    if (noteErr || !note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const contentType = request.headers.get('content-type') ?? '';
    let kind: 'voice' | 'text';
    let storage_path: string | null = null;
    let text_content: string | null = null;
    let transcript: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (file instanceof File) {
        kind = 'voice';
        if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Unsupported audio type' }, { status: 400 });
        if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 400 });
        const ext = file.name.split('.').pop() || 'webm';
        storage_path = `${userId}/${caseId}/${noteId}/${crypto.randomUUID()}.${ext}`;
        const bytes = Buffer.from(await file.arrayBuffer());
        const { error: uploadErr } = await supabaseServer.storage.from(BUCKET).upload(storage_path, bytes, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadErr) return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
        try {
          transcript = await transcribeAudio(bytes, file.type);
        } catch {
          transcript = null;
        }
      } else {
        const text = String(formData.get('text') ?? '').trim();
        if (!text) return NextResponse.json({ error: 'text or file required' }, { status: 400 });
        kind = 'text';
        text_content = text;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      const text = String(body?.text ?? '').trim();
      if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
      kind = 'text';
      text_content = text;
    }

    const { data: addendum, error: insertErr } = await (supabaseServer.from('voice_note_addenda') as any)
      .insert({
        voice_note_id: noteId,
        kind,
        storage_path,
        text_content,
        transcript,
      })
      .select()
      .single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ addendum }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Add failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
