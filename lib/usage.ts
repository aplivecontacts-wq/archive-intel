/**
 * Record LLM token usage for a user. Increments running totals in user_token_usage.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OpenAIUsage } from '@/lib/ai/openai';

export async function recordTokenUsage(
  supabase: SupabaseClient,
  userId: string,
  usage: OpenAIUsage
): Promise<void> {
  const { data: row } = await (supabase as any)
    .from('user_token_usage')
    .select('prompt_tokens, completion_tokens, total_tokens')
    .eq('user_id', userId)
    .maybeSingle();

  const prev = row ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const next = {
    user_id: userId,
    prompt_tokens: Number(prev.prompt_tokens) + usage.prompt_tokens,
    completion_tokens: Number(prev.completion_tokens) + usage.completion_tokens,
    total_tokens: Number(prev.total_tokens) + usage.total_tokens,
    updated_at: new Date().toISOString(),
  };

  await (supabase as any)
    .from('user_token_usage')
    .upsert(next, { onConflict: 'user_id' });
}
