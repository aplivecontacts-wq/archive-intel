import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

const BUCKET = 'voice-notes';

export async function GET(
  _request: NextRequest,
  { params }: { params: { caseId: string; noteId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { caseId, noteId } = params ?? {};
    if (!caseId || !noteId) return NextResponse.json({ error: 'caseId and noteId required' }, { status: 400 });

    const { data: note, error: noteErr } = await (supabaseServer.from('voice_notes') as any)
      .select('*')
      .eq('id', noteId)
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .maybeSingle();
    if (noteErr || !note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: addenda } = await (supabaseServer.from('voice_note_addenda') as any)
      .select('*')
      .eq('voice_note_id', noteId)
      .order('created_at', { ascending: true });

    const noteUrl = (await supabaseServer.storage.from(BUCKET).createSignedUrl(note.storage_path, 3600)).data?.signedUrl ?? null;
    const addendaWithUrls = await Promise.all(
      (addenda || []).map(async (a: { storage_path?: string | null; [k: string]: unknown }) => {
        if (!a.storage_path) return { ...a, url: null };
        const { data: d } = await supabaseServer.storage.from(BUCKET).createSignedUrl(a.storage_path, 3600);
        return { ...a, url: d?.signedUrl ?? null };
      })
    );

    return NextResponse.json({
      voiceNote: { ...note, url: noteUrl },
      addenda: addendaWithUrls,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { caseId: string; noteId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { caseId, noteId } = params ?? {};
    if (!caseId || !noteId) return NextResponse.json({ error: 'caseId and noteId required' }, { status: 400 });

    const { data: note, error: noteErr } = await (supabaseServer.from('voice_notes') as any)
      .select('id, storage_path')
      .eq('id', noteId)
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .maybeSingle();
    if (noteErr || !note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: addenda } = await (supabaseServer.from('voice_note_addenda') as any)
      .select('storage_path')
      .eq('voice_note_id', noteId);
    const pathsToRemove: string[] = [note.storage_path];
    for (const a of addenda ?? []) {
      if (a?.storage_path) pathsToRemove.push(a.storage_path);
    }
    await supabaseServer.storage.from(BUCKET).remove(pathsToRemove);
    const { error: delErr } = await (supabaseServer.from('voice_notes') as any)
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId)
      .eq('case_id', caseId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
