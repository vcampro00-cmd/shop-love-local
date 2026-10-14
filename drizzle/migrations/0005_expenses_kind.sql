ALTER TABLE public.expenses ADD COLUMN kind text NOT NULL DEFAULT 'sortie';
ALTER TABLE public.expenses ADD CONSTRAINT expenses_kind_check CHECK (kind IN ('entree','sortie','achat'));
COMMENT ON COLUMN public.expenses.kind IS 'entree = entrée manuelle, sortie = dépense, achat = achat de téléphones';