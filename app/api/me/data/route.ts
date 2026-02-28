import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/me/data
 * Deletes all data owned by the current user: note_attachments, saved_link_attachments, saved_links, cases (and cascaded),
 * user_token_usage. Does not delete user_tiers (billing). Irreversible.
 */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tbl = (supabaseServer as any);

    // Order: note_attachments, saved_link_attachments (then storage), saved_links, cases, token usage
    const { error: errAtt } = await tbl.from('note_attachments').delete().eq('user_id', userId);
    if (errAtt) {
      if (process.env.NODE_ENV === 'development') console.error('[api/me/data] note_attachments delete:', errAtt);
      return NextResponse.json({ error: errAtt.message }, { status: 500 });
    }

    const { data: linkAttRows } = await tbl.from('saved_link_attachments').select('storage_path').eq('user_id', userId);
    if (Array.isArray(linkAttRows) && linkAttRows.length > 0) {
      const paths = linkAttRows.map((r: { storage_path: string }) => r.storage_path);
      await supabaseServer.storage.from('saved-link-attachments').remove(paths);
    }
    const { error: errLinkAtt } = await tbl.from('saved_link_attachments').delete().eq('user_id', userId);
    if (errLinkAtt) {
      if (process.env.NODE_ENV === 'development') console.error('[api/me/data] saved_link_attachments delete:', errLinkAtt);
      return NextResponse.json({ error: errLinkAtt.message }, { status: 500 });
    }

    const { error: errSaved } = await tbl.from('saved_links').delete().eq('user_id', userId);
    if (errSaved) {
      if (process.env.NODE_ENV === 'development') console.error('[api/me/data] saved_links delete:', errSaved);
      return NextResponse.json({ error: errSaved.message }, { status: 500 });
    }

    const { error: errCases } = await tbl.from('cases').delete().eq('user_id', userId);
    if (errCases) {
      if (process.env.NODE_ENV === 'development') console.error('[api/me/data] cases delete:', errCases);
      return NextResponse.json({ error: errCases.message }, { status: 500 });
    }

    const { error: errUsage } = await tbl.from('user_token_usage').delete().eq('user_id', userId);
    if (errUsage) {
      if (process.env.NODE_ENV === 'development') console.error('[api/me/data] user_token_usage delete:', errUsage);
      return NextResponse.json({ error: errUsage.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'All your data has been deleted.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete data';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
