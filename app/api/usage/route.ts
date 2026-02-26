import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: row, error } = await (supabaseServer as any)
      .from('user_token_usage')
      .select('prompt_tokens, completion_tokens, total_tokens, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const prompt_tokens = row ? Number(row.prompt_tokens) : 0;
    const completion_tokens = row ? Number(row.completion_tokens) : 0;
    const total_tokens = row ? Number(row.total_tokens) : 0;

    return NextResponse.json({
      prompt_tokens,
      completion_tokens,
      total_tokens,
      updated_at: row?.updated_at ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}
