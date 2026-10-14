ALTER TABLE public.orders
  ADD COLUMN payment_plan text NOT NULL DEFAULT 'full' CHECK (payment_plan IN ('full','split')),
  ADD COLUMN payment_status text NOT NULL DEFAULT 'en_attente' CHECK (payment_status IN ('en_attente','paye','acompte_paye','echec_solde')),
  ADD COLUMN amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN second_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN second_charge_due_at timestamptz,
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_payment_method_id text,
  ADD COLUMN payment_env text;

DROP POLICY IF EXISTS "Customers place their own orders" ON public.orders;
CREATE POLICY "Customers place their own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND payment_status = 'en_attente'
    AND amount_paid = 0
    AND stripe_customer_id IS NULL
    AND stripe_payment_method_id IS NULL
    AND second_charge_due_at IS NULL
  );

CREATE INDEX orders_second_charge_idx ON public.orders (second_charge_due_at)
  WHERE payment_status = 'acompte_paye';