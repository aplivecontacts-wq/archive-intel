-- File attachments for Notes tab (PDF/images), scoped by query and user.
CREATE TABLE IF NOT EXISTS note_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_attachments_user_id ON note_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_note_attachments_query_id ON note_attachments(query_id);

COMMENT ON TABLE note_attachments IS 'Uploaded files for Notes tab (PDF and images).';

-- Create private storage bucket used by server-side signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-attachments',
  'note-attachments',
  false,
  26214400,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
