-- RLS for saved_link_attachments (service role bypasses; anon cannot access).
ALTER TABLE public.saved_link_attachments ENABLE ROW LEVEL SECURITY;
