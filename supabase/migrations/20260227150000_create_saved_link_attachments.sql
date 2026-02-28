-- Attachments for saved links (e.g. manual entry PDF/image).
CREATE TABLE IF NOT EXISTS saved_link_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  saved_link_id uuid NOT NULL REFERENCES saved_links(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_link_attachments_user_id ON saved_link_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_link_attachments_saved_link_id ON saved_link_attachments(saved_link_id);

COMMENT ON TABLE saved_link_attachments IS 'Uploaded files for saved links (e.g. manual entry PDF/image).';

-- Storage bucket (same limits as note-attachments).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saved-link-attachments',
  'saved-link-attachments',
  false,
  26214400,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
