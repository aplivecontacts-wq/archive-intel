import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// Ensure .env.local is loaded in API route context (Next.js sometimes doesn't inject)
config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local in the project root and restart the dev server.'
  );
}

export const supabaseServer = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey
);
