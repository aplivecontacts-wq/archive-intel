-- Per-saved-link notes: paste URLs or text found from this saved link (e.g. follow-up URLs of interest).
ALTER TABLE saved_links
  ADD COLUMN IF NOT EXISTS link_notes text;

COMMENT ON COLUMN saved_links.link_notes IS 'Optional user note for this saved link (e.g. URLs or text found from this link).';
