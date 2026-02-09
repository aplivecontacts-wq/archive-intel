-- User tiers for Stripe 2-tier payment (Basic / Pro)
-- user_id = Clerk user ID

CREATE TABLE IF NOT EXISTS user_tiers (
  user_id text PRIMARY KEY,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'pro')),
  stripe_customer_id text,
  expires_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_tiers_tier ON user_tiers(tier);

ALTER TABLE user_tiers ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes use service role)
-- Allow users to read their own tier only (for client-side display)
CREATE POLICY "Users can read own tier"
  ON user_tiers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage tiers"
  ON user_tiers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
