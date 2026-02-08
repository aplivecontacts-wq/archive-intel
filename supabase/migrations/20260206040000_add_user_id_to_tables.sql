-- Add user_id (Clerk user id) to all user-scoped tables

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS user_id text;

ALTER TABLE queries
  ADD COLUMN IF NOT EXISTS user_id text;

ALTER TABLE results
  ADD COLUMN IF NOT EXISTS user_id text;

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS user_id text;

-- Indexes for filtering by user_id
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON queries(user_id);
CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
