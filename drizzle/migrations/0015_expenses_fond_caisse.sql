ALTER TABLE public.expenses DROP CONSTRAINT expenses_kind_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_kind_check CHECK (kind IN ('entree','sortie','achat','salaire','fond'));