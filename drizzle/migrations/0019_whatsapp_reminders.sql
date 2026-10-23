CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  source_id uuid NOT NULL,
  due_on date NOT NULL,
  phone text NOT NULL,
  wa_message_id text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  status_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, source_id, due_on)
);
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text
);
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp events" ON public.whatsapp_webhook_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));