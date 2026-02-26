-- Add optional objective to cases. Used to orient brief generation and display.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS objective text;

COMMENT ON COLUMN cases.objective IS 'Optional case objective: what the user is trying to find out or decide. Brief generation orients all sections toward this.';
