-- Phase 3 (Cohesion): Entity graph — case_entities + entity_mentions
-- user_id = Clerk user ID

CREATE TABLE IF NOT EXISTS case_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  name text NOT NULL,
  entity_type text NOT NULL,
  mention_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, user_id, name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_case_entities_case_id ON case_entities(case_id);
CREATE INDEX IF NOT EXISTS idx_case_entities_user_id ON case_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_case_entities_mention_count ON case_entities(case_id, user_id, mention_count DESC);

COMMENT ON TABLE case_entities IS 'Extracted entities per case (deterministic extraction from notes/results/saved_links).';

CREATE TABLE IF NOT EXISTS entity_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  entity_id uuid NOT NULL REFERENCES case_entities(id) ON DELETE CASCADE,
  evidence_kind text NOT NULL,
  evidence_id text NOT NULL,
  query_id uuid,
  source_ref text,
  context_snippet text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_case_id ON entity_mentions(case_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_user_id ON entity_mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_id ON entity_mentions(entity_id);

COMMENT ON TABLE entity_mentions IS 'Per-mention record linking entity to result/saved_link/note.';

ALTER TABLE case_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage case_entities"
  ON case_entities FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage entity_mentions"
  ON entity_mentions FOR ALL TO service_role USING (true) WITH CHECK (true);
