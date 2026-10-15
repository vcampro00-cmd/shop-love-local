GRANT DELETE ON public.orders TO authenticated;
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));