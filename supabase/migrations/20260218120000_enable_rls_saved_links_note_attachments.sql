-- Enable RLS on public tables to satisfy Supabase Security Advisor.
-- The app uses the service role (supabaseServer) for all access; service role bypasses RLS,
-- so this does not change app behavior. Direct API access with anon key will no longer
-- be able to read/write these tables.

ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_attachments ENABLE ROW LEVEL SECURITY;
