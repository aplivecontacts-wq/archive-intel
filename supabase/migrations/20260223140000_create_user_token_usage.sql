-- Per-user API token usage (Clerk user_id). Running totals; increment on each LLM call.
CREATE TABLE IF NOT EXISTS user_token_usage (
  user_id text PRIMARY KEY,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can read/update only their own row
ALTER TABLE user_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own token usage"
  ON user_token_usage FOR SELECT
  USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can insert own token usage"
  ON user_token_usage FOR INSERT
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can update own token usage"
  ON user_token_usage FOR UPDATE
  USING (auth.jwt() ->> 'sub' = user_id);

COMMENT ON TABLE user_token_usage IS 'Running total of LLM token usage per user (Clerk user_id).';
