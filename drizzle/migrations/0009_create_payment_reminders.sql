CREATE TABLE public.payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  payment_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reminders TO authenticated;
GRANT ALL ON public.payment_reminders TO service_role;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reminders" ON public.payment_reminders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));