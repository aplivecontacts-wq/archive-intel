-- Phase 5 (Cohesion): Case Tasks — actionable workflow items from verification_tasks / critical_gaps
CREATE TABLE IF NOT EXISTS case_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  title text NOT NULL,
  detail text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  linked_entity_ids uuid[],
  linked_evidence_ids text[],
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_tasks_case_user ON case_tasks(case_id, user_id);
CREATE INDEX IF NOT EXISTS idx_case_tasks_status ON case_tasks(status);
