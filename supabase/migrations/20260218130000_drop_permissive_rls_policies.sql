-- Drop permissive RLS policies that allow unrestricted INSERT/UPDATE/DELETE (Security Advisor warnings).
-- The app uses the service role (supabaseServer) for all write access; service role bypasses RLS,
-- so this does not change app behavior. SELECT policies are kept for read access.
-- Direct anon/authenticated API access will no longer be able to insert/update/delete these tables.

-- cases
DROP POLICY IF EXISTS "Allow public delete to cases" ON public.cases;
DROP POLICY IF EXISTS "Allow public insert to cases" ON public.cases;
DROP POLICY IF EXISTS "Allow public update to cases" ON public.cases;

-- notes
DROP POLICY IF EXISTS "Allow public delete to notes" ON public.notes;
DROP POLICY IF EXISTS "Allow public insert to notes" ON public.notes;
DROP POLICY IF EXISTS "Allow public update to notes" ON public.notes;

-- queries
DROP POLICY IF EXISTS "Allow public delete to queries" ON public.queries;
DROP POLICY IF EXISTS "Allow public insert to queries" ON public.queries;
DROP POLICY IF EXISTS "Allow public update to queries" ON public.queries;

-- results
DROP POLICY IF EXISTS "Allow public delete to results" ON public.results;
DROP POLICY IF EXISTS "Allow public insert to results" ON public.results;
DROP POLICY IF EXISTS "Allow public update to results" ON public.results;
