import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

const BUCKET = 'voice-notes';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { caseId: string; noteId: string; addendumId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { caseId, noteId, addendumId } = params ?? {};
    if (!caseId || !noteId || !addendumId) {
      return NextResponse.json({ error: 'caseId, noteId and addendumId required' }, { status: 400 });
    }

    const { data: note, error: noteErr } = await (supabaseServer.from('voice_notes') as any)
      .select('id')
      .eq('id', noteId)
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .maybeSingle();
    if (noteErr || !note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: addendum, error: addErr } = await (supabaseServer.from('voice_note_addenda') as any)
      .select('id, storage_path')
      .eq('id', addendumId)
      .eq('voice_note_id', noteId)
      .maybeSingle();
    if (addErr || !addendum) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (addendum.storage_path) {
      await supabaseServer.storage.from(BUCKET).remove([addendum.storage_path]);
    }
    const { error: delErr } = await (supabaseServer.from('voice_note_addenda') as any)
      .delete()
      .eq('id', addendumId)
      .eq('voice_note_id', noteId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
