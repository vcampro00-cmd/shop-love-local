ALTER TABLE public.payment_reminders ADD COLUMN IF NOT EXISTS paid_session_id TEXT UNIQUE;
ALTER TABLE public.payment_reminders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;