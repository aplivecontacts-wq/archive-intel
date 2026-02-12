-- Case-scoped archive saves: same URL can be saved in different cases (one URL per case).
-- Add case_id; replace single unique with partial uniques so archive is (user_id, url, source, case_id).

ALTER TABLE saved_links
  ADD COLUMN IF NOT EXISTS case_id text;

-- Drop the original unique so we can have archive rows per case.
ALTER TABLE saved_links
  DROP CONSTRAINT IF EXISTS saved_links_user_id_url_source_key;

-- Archive: one row per (user, url, source, case_id) — same URL in different cases = different rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_links_archive_unique
  ON saved_links (user_id, url, source, case_id)
  WHERE source = 'archive';

-- Query/Official: keep one row per (user, url, source) as before.
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_links_result_unique
  ON saved_links (user_id, url, source)
  WHERE source IN ('query', 'official');

CREATE INDEX IF NOT EXISTS idx_saved_links_case_id ON saved_links(case_id);

COMMENT ON COLUMN saved_links.case_id IS 'For archive saves: which case this link belongs to. Null for legacy or non-archive.';
