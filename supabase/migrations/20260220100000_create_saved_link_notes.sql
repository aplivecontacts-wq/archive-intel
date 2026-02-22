-- Multiple notes per saved link (Note 1, Note 2, ...) like the Notes tab.
CREATE TABLE IF NOT EXISTS public.saved_link_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_link_id uuid NOT NULL REFERENCES public.saved_links(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_link_notes_saved_link_id ON public.saved_link_notes(saved_link_id);

COMMENT ON TABLE public.saved_link_notes IS 'Multiple notes per saved link (e.g. URLs or text found from that link).';

ALTER TABLE public.saved_link_notes ENABLE ROW LEVEL SECURITY;
