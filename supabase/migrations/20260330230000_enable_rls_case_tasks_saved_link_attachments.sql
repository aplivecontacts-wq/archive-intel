-- Supabase linter: rls_disabled_in_public (lint 0013)
-- App uses service role from API routes only; service role bypasses RLS.
-- Enabling RLS blocks direct PostgREST access via anon/authenticated when no permissive policies exist.

ALTER TABLE public.case_tasks ENABLE ROW LEVEL SECURITY;

-- Idempotent if 20260227160000 already ran on this database.
ALTER TABLE public.saved_link_attachments ENABLE ROW LEVEL SECURITY;
