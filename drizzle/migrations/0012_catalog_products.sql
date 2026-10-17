CREATE TABLE public.catalog_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  tag text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL CHECK (price >= 0),
  commission numeric NOT NULL DEFAULT 0 CHECK (commission >= 0),
  full_payment_only boolean NOT NULL DEFAULT false,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalog readable" ON public.catalog_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage catalog" ON public.catalog_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.catalog_products (id, name, tag, description, price, commission, full_payment_only, sort)
SELECT v.id,
  COALESCE((SELECT value FROM public.site_texts WHERE key = 'product.' || v.id || '.name'), v.name),
  COALESCE((SELECT value FROM public.site_texts WHERE key = 'product.' || v.id || '.tag'), v.tag),
  COALESCE((SELECT value FROM public.site_texts WHERE key = 'product.' || v.id || '.description'), v.descr),
  COALESCE(NULLIF(regexp_replace(replace((SELECT value FROM public.site_texts WHERE key = 'product.' || v.id || '.price'), ',', '.'), '[^0-9.]', '', 'g'), '')::numeric, v.price),
  v.commission, v.fpo, v.sort
FROM (VALUES
  ('iphone-se-2020', 'iPhone SE 2020', 'Apple', 'Téléphone dédié à Uber et Bolt, fonctionnel et pratique. Le téléphone reste avec le chauffeur. Abonnement de 20 € par semaine.', 300::numeric, 50::numeric, false, 1),
  ('clone-deliveroo', 'Duo Android', 'Android ×2', 'Deux téléphones Android livrés ensemble : le téléphone principal reste avec le propriétaire et l''autre avec le livreur, fonctionnels et pratiques. Abonnement de 15 € par semaine.', 380::numeric, 60::numeric, false, 2),
  ('iphone-7-gps-manager', 'iPhone 7 GPS Manager', 'Apple', '', 150::numeric, 50::numeric, true, 3)
) AS v(id, name, tag, descr, price, commission, fpo, sort);

CREATE POLICY "Product images public read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admins upload product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));