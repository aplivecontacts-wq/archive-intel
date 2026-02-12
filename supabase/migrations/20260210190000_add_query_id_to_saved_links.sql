-- Scope saved links to query so saved state does not bleed across queries
ALTER TABLE saved_links
  ADD COLUMN IF NOT EXISTS query_id text;

CREATE INDEX IF NOT EXISTS idx_saved_links_query_id ON saved_links(query_id);

COMMENT ON COLUMN saved_links.query_id IS 'Optional: links from Archive/Queries tab are scoped to this query_id';
