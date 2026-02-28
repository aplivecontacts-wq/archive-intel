-- Analyst can mark a saved link as "official source" (e.g. leaked tax doc, court filing).
-- Used for credibility scoring when URL is not .gov or established news.
ALTER TABLE saved_links
  ADD COLUMN IF NOT EXISTS official_source boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN saved_links.official_source IS 'Analyst-marked: treat as official for credibility (e.g. leaked official doc, court filing).';
