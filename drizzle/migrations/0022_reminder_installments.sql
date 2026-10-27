ALTER TABLE public.payment_reminders
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS installment int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS installments int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS group_total numeric,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS payment_env text,
  ADD COLUMN IF NOT EXISTS charge_error text,
  ADD COLUMN IF NOT EXISTS contract_accepted_at timestamptz;
CREATE INDEX IF NOT EXISTS payment_reminders_group_idx ON public.payment_reminders(group_id);