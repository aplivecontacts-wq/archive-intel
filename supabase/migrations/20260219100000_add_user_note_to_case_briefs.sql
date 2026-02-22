-- Optional user note per forensic brief (quick note about the brief)
ALTER TABLE case_briefs
  ADD COLUMN IF NOT EXISTS user_note text;

COMMENT ON COLUMN case_briefs.user_note IS 'Optional quick note from the user about this brief';
