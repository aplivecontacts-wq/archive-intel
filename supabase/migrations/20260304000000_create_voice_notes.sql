-- Voice notes: query-scoped recordings, with optional addenda (follow-up voice or text).
-- Used by VOICE tab and floating mic; Organize transcribes and orders by recorded_at.

CREATE TABLE IF NOT EXISTS voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_note_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_note_id uuid NOT NULL REFERENCES voice_notes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('voice', 'text')),
  storage_path text,
  text_content text,
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_user_id ON voice_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_query_id ON voice_notes(query_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_case_id ON voice_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_recorded_at ON voice_notes(recorded_at ASC);
CREATE INDEX IF NOT EXISTS idx_voice_note_addenda_voice_note_id ON voice_note_addenda(voice_note_id);

COMMENT ON TABLE voice_notes IS 'Voice recordings per query; transcript filled by Organize.';
COMMENT ON TABLE voice_note_addenda IS 'Add more: follow-up voice or text on a voice note.';

-- Storage bucket for voice audio (webm, mpeg, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  false,
  52428800,
  ARRAY['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS enabled; app uses service role (bypasses RLS). No policies = no direct anon access.
ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_note_addenda ENABLE ROW LEVEL SECURITY;
