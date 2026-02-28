import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const BUCKET = 'saved-link-attachments';
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

async function ensureSavedLinkOwnership(savedLinkId: string, userId: string): Promise<boolean> {
  const { data, error } = await (supabaseServer.from('saved_links') as any)
    .select('id')
    .eq('id', savedLinkId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { savedLinkId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const savedLinkId = params?.savedLinkId;
    if (!savedLinkId) return NextResponse.json({ error: 'savedLinkId is required' }, { status: 400 });

    const allowed = await ensureSavedLinkOwnership(savedLinkId, userId);
    if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data, error } = await (supabaseServer.from('saved_link_attachments') as any)
      .select('*')
      .eq('user_id', userId)
      .eq('saved_link_id', savedLinkId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const attachments = await Promise.all(
      (data || []).map(async (row: { storage_path: string; [k: string]: unknown }) => {
        const { data: signed } = await supabaseServer.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, 3600);
        return { ...row, url: signed?.signedUrl || null };
      })
    );

    return NextResponse.json({ attachments });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch attachments';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved-links/attachments] GET:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { savedLinkId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const savedLinkId = params?.savedLinkId;
    if (!savedLinkId) return NextResponse.json({ error: 'savedLinkId is required' }, { status: 400 });

    const allowed = await ensureSavedLinkOwnership(savedLinkId, userId);
    if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type (PDF, PNG, JPEG, WebP only)' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 25MB limit' }, { status: 400 });
    }

    const safeName = sanitizeFileName(file.name || 'upload');
    const storagePath = `${userId}/${savedLinkId}/${Date.now()}-${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseServer.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadErr) {
      if (process.env.NODE_ENV === 'development') console.error('[api/saved-links/attachments] POST upload:', uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const row = {
      user_id: userId,
      saved_link_id: savedLinkId,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
    };

    const { data, error } = await (supabaseServer.from('saved_link_attachments') as any)
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
    if (process.env.NODE_ENV === 'development') console.error('[api/saved-links/attachments] POST:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { savedLinkId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const savedLinkId = params?.savedLinkId;
    if (!savedLinkId) return NextResponse.json({ error: 'savedLinkId is required' }, { status: 400 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const allowed = await ensureSavedLinkOwnership(savedLinkId, userId);
    if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: row, error: fetchErr } = await (supabaseServer.from('saved_link_attachments') as any)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('saved_link_id', savedLinkId)
      .maybeSingle();
    if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { error: removeErr } = await supabaseServer.storage.from(BUCKET).remove([row.storage_path]);
    if (removeErr) {
      if (process.env.NODE_ENV === 'development') console.error('[api/saved-links/attachments] DELETE storage:', removeErr);
      return NextResponse.json({ error: removeErr.message }, { status: 500 });
    }

    const { error: deleteErr } = await (supabaseServer.from('saved_link_attachments') as any)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete attachment';
    if (process.env.NODE_ENV === 'development') console.error('[api/saved-links/attachments] DELETE:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
