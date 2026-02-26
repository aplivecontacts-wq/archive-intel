-- Phase 2 (Cohesion): Extract key facts for saved links — optional enrichment fields
ALTER TABLE saved_links
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_error text,
  ADD COLUMN IF NOT EXISTS extracted_facts jsonb;

COMMENT ON COLUMN saved_links.extracted_text IS 'Plain text extracted from URL (max 50KB stored).';
COMMENT ON COLUMN saved_links.extracted_at IS 'When extraction was last run.';
COMMENT ON COLUMN saved_links.extraction_error IS 'Error message if fetch/extract failed.';
COMMENT ON COLUMN saved_links.extracted_facts IS 'Heuristic key facts: { key_claims, key_entities, key_dates, summary }.';
