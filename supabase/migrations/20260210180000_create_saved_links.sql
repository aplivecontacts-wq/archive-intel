-- Saved/bookmarked links from Archive, Queries, and Official Sources
CREATE TABLE IF NOT EXISTS saved_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('archive', 'query', 'official')),
  url text NOT NULL,
  title text,
  snippet text,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, url, source)
);

CREATE INDEX IF NOT EXISTS idx_saved_links_user_id ON saved_links(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_links_source ON saved_links(source);

COMMENT ON TABLE saved_links IS 'User bookmarks from archive results, discovery queries, and official sources';
