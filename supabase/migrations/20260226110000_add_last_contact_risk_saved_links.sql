-- Source management: last contact date and risk level for saved links (e.g. whistleblower tracking).
ALTER TABLE saved_links
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS risk_level text;

COMMENT ON COLUMN saved_links.last_contact_at IS 'Last contact date with this source (e.g. for whistleblower follow-up).';
COMMENT ON COLUMN saved_links.risk_level IS 'User-defined risk: low, medium, high, whistleblower, or null.';
