import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

const BUCKET = 'note-attachments';
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const queryId = request.nextUrl.searchParams.get('queryId');
    if (!queryId) return NextResponse.json({ error: 'queryId is required' }, { status: 400 });

    const { data, error } = await (supabaseServer.from('note_attachments') as any)
      .select('*')
      .eq('user_id', userId)
      .eq('query_id', queryId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const attachments = await Promise.all(
      (data || []).map(async (row: any) => {
        const { data: signed, error: signErr } = await supabaseServer.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, 3600);
        if (signErr) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[api/attachments] GET sign error:', signErr);
          }
        }
        return {
          ...row,
          url: signed?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ attachments });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch attachments';
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/attachments] GET catch:', error);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const queryId = String(formData.get('queryId') || '').trim();
    const file = formData.get('file');

    if (!queryId) return NextResponse.json({ error: 'queryId is required' }, { status: 400 });
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 25MB limit' }, { status: 400 });
    }

    const { data: queryRow, error: queryErr } = await (supabaseServer.from('queries') as any)
      .select('id')
      .eq('id', queryId)
      .eq('user_id', userId)
      .maybeSingle();
    if (queryErr || !queryRow) {
      return NextResponse.json({ error: 'Invalid queryId' }, { status: 403 });
    }

    const safeName = sanitizeFileName(file.name || 'upload');
    const storagePath = `${userId}/${queryId}/${Date.now()}-${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseServer.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[api/attachments] POST upload error:', uploadErr);
      }
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const row = {
      user_id: userId,
      query_id: queryId,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
    };

    const { data, error } = await (supabaseServer.from('note_attachments') as any)
      .insert(row)
      .select()
      .single();
    if (error) {
      await supabaseServer.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: signed } = await supabaseServer.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
    return NextResponse.json({ attachment: { ...data, url: signed?.signedUrl || null } }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to upload attachment';
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/attachments] POST catch:', error);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: row, error: fetchErr } = await (supabaseServer.from('note_attachments') as any)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error: removeErr } = await supabaseServer.storage.from(BUCKET).remove([row.storage_path]);
    if (removeErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[api/attachments] DELETE storage error:', removeErr);
      }
      return NextResponse.json({ error: removeErr.message }, { status: 500 });
    }

    const { error: deleteErr } = await (supabaseServer.from('note_attachments') as any)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete attachment';
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/attachments] DELETE catch:', error);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
