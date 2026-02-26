-- AI-read link analysis: summary, key_facts, entities from LLM (per-link "open and analyze").
ALTER TABLE saved_links
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_key_facts jsonb,
  ADD COLUMN IF NOT EXISTS ai_entities jsonb,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz;

COMMENT ON COLUMN saved_links.ai_summary IS '2-4 sentence summary from AI reading the page.';
COMMENT ON COLUMN saved_links.ai_key_facts IS 'Array of 5-12 concrete facts from the page (AI).';
COMMENT ON COLUMN saved_links.ai_entities IS 'Array of { name, type, context } from the page (AI).';
COMMENT ON COLUMN saved_links.ai_analyzed_at IS 'When AI analysis was last run.';
