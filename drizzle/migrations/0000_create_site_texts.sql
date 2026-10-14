CREATE TABLE public.site_texts (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_texts TO anon;
GRANT ALL ON public.site_texts TO service_role;

ALTER TABLE public.site_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_texts_readable_publicly"
  ON public.site_texts FOR SELECT
  TO anon, authenticated
  USING (true);