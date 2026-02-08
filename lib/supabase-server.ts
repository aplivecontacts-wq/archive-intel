import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseServer = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey
);
