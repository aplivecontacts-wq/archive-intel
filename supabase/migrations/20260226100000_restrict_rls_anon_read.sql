-- Restrict RLS so anon/authenticated roles cannot read any rows.
-- The app uses the service role (supabaseServer) for all API access; service role bypasses RLS,
-- so this does not change app behavior. Direct DB access with anon key will return no rows.

-- cases
DROP POLICY IF EXISTS "Allow public read access to cases" ON public.cases;

-- queries
DROP POLICY IF EXISTS "Allow public read access to queries" ON public.queries;

-- results
DROP POLICY IF EXISTS "Allow public read access to results" ON public.results;

-- notes
DROP POLICY IF EXISTS "Allow public read access to notes" ON public.notes;
