-- case_briefs: versioned brief storage for AI Forensic Brief Engine
-- clerk_user_id = Clerk user ID (not Supabase auth)

CREATE TABLE IF NOT EXISTS case_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  brief_json jsonb NOT NULL,
  evidence_counts jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, clerk_user_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_case_briefs_case_id ON case_briefs(case_id);
CREATE INDEX IF NOT EXISTS idx_case_briefs_clerk_user_id ON case_briefs(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_case_briefs_case_user ON case_briefs(case_id, clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_case_briefs_created_at ON case_briefs(created_at);

COMMENT ON TABLE case_briefs IS 'Versioned brief storage for AI Forensic Brief Engine';

ALTER TABLE case_briefs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API routes use service role)
-- No anon/authenticated policies: direct client access blocked; rely on server for all ops
CREATE POLICY "Service role can manage case_briefs"
  ON case_briefs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
