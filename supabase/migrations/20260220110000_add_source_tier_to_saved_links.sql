-- Primary/secondary source marking for saved links (P/S buttons in Saved tab)
ALTER TABLE saved_links
  ADD COLUMN IF NOT EXISTS source_tier text
  CHECK (source_tier IS NULL OR source_tier IN ('primary', 'secondary'));

COMMENT ON COLUMN saved_links.source_tier IS 'User-designated: primary source (P) or secondary source (S). NULL = unset.';
