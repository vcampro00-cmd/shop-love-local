CREATE TABLE public.product_stock (
  product_id text PRIMARY KEY,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock TO authenticated;
GRANT ALL ON public.product_stock TO service_role;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stock" ON public.product_stock FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.promo_codes (
  code text PRIMARY KEY,
  amount numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders ADD COLUMN discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN promo_code text;
ALTER TABLE public.orders ADD COLUMN seller_id uuid;
ALTER TABLE public.expenses ADD COLUMN order_id uuid;
CREATE UNIQUE INDEX expenses_order_commission_uniq ON public.expenses (order_id) WHERE order_id IS NOT NULL;